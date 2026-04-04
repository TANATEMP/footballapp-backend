import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../database/prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
} from '../../common/utils/crypto.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive)
      return {
        success: true,
        message: 'If the email exists, a reset link will be sent.',
      };

    const token = generateSecureToken(32);
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpires: expires },
    });

    await this.mailService.sendPasswordResetEmail(user.email, token, user.name);

    return { success: true, message: 'Reset link sent.' };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { success: true, message: 'Password updated successfully.' };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Registration failed. Please try again.');
    }

    const roleMap: Record<string, UserRole> = {
      player: UserRole.PLAYER,
      manager: UserRole.MANAGER,
    };
    const assignedRole = roleMap[dto.role || 'player'] || UserRole.PLAYER;

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: assignedRole,
      },
    });

    return this.generateTokenPair(user);
  }

  async login(dto: LoginDto, ip: string) {
    await this.checkAccountLockout(dto.email, ip);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummy';
    const passwordValid =
      user && user.passwordHash
        ? await verifyPassword(user.passwordHash, dto.password)
        : await verifyPassword(dummyHash, dto.password).catch(() => false);

    if (!user || !passwordValid || !user.isActive) {
      await this.recordFailedLogin(dto.email, ip);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.cacheManager.del(`login_attempts:${dto.email}`);
    await this.cacheManager.del(`login_attempts_ip:${ip}`);

    return this.generateTokenPair(user);
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const userId = await this.cacheManager.get<string>(
      `refresh:${refreshToken}`,
    );
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    await this.cacheManager.del(`refresh:${refreshToken}`);
    return this.generateTokenPair(user);
  }

  async logout(accessToken?: string, refreshToken?: string) {
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as any;
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await this.cacheManager.set(
              `blacklist:${accessToken}`,
              '1',
              ttl * 1000,
            );
          }
        }
      } catch (error) {
      }
    }

    if (refreshToken) {
      await this.cacheManager.del(`refresh:${refreshToken}`);
    }
  }

  async verifyGoogleAccessToken(accessToken: string, requestedRole?: string) {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google Token');
      }

      const profile = await response.json();

      return await this.validateOAuthUser({
        email: profile.email,
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        providerId: profile.sub,
        role: requestedRole,
      });
    } catch (error: any) {
      if (error.status) {
        throw error;
      }
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async validateOAuthUser(profile: any) {
    const { email, firstName, lastName, providerId, role } = profile;

    const oauthAccount = await this.prisma.oauthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: providerId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      if (!oauthAccount.user.isActive) {
        throw new ForbiddenException('User account is deactivated');
      }
      if (role) {
        throw new ConflictException(
          `อีเมลนี้ถูกลงทะเบียนไว้แล้วในฐานะ ${oauthAccount.user.role} กรุณาไปที่หน้า "เข้าสู่ระบบ"`,
        );
      }
      return this.generateTokenPair(oauthAccount.user);
    }

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      if (role) {
        throw new ConflictException(
          `อีเมลนี้ถูกลงทะเบียนไว้แล้วในฐานะ ${user.role} กรุณาไปที่หน้า "เข้าสู่ระบบ"`,
        );
      }
    }

    if (!user) {
      if (!role) {
        throw new UnauthorizedException(
          'ไม่พบบัญชีผู้ใช้นี้ กรุณาไปที่หน้าสมัครสมาชิกเพื่อเลือก Role ก่อนทำรายการ',
        );
      }

      const roleMap: Record<string, UserRole> = {
        player: UserRole.PLAYER,
        manager: UserRole.MANAGER,
      };

      const assignedRole = roleMap[role.toLowerCase()];
      if (!assignedRole) {
        throw new UnauthorizedException('Role ที่เลือกไม่ถูกต้อง');
      }

      user = await this.prisma.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          role: assignedRole,
          isActive: true,
        },
      });
    }

    await this.prisma.oauthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerAccountId: providerId,
      },
    });

    return this.generateTokenPair(user);
  }

  private async generateTokenPair(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iss: 'football-api',
      aud: 'football-client',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = generateSecureToken(64);
    const refreshTtl = 7 * 24 * 60 * 60 * 1000;
    await this.cacheManager.set(`refresh:${refreshToken}`, user.id, refreshTtl);
    return {
      message: 'Authentication successful',
      data: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    };
  }

  private async checkAccountLockout(email: string, ip: string) {
    const locked = await this.cacheManager.get(`account_locked:${email}`);
    if (locked)
      throw new ForbiddenException(
        'Account temporarily locked. Try again in 15 minutes.',
      );

    const ipLocked = await this.cacheManager.get(`ip_locked:${ip}`);
    if (ipLocked)
      throw new ForbiddenException(
        'Too many failed attempts from your IP. Try again in 15 minutes.',
      );
  }

  private async recordFailedLogin(email: string, ip: string) {
    const emailKey = `login_attempts:${email}`;
    const ipKey = `login_attempts_ip:${ip}`;
    const lockTtl = 15 * 60 * 1000;

    const emailAttempts =
      ((await this.cacheManager.get<number>(emailKey)) || 0) + 1;
    const ipAttempts = ((await this.cacheManager.get<number>(ipKey)) || 0) + 1;

    await this.cacheManager.set(emailKey, emailAttempts, lockTtl);
    await this.cacheManager.set(ipKey, ipAttempts, lockTtl);

    if (emailAttempts >= 5)
      await this.cacheManager.set(`account_locked:${email}`, '1', lockTtl);
    if (ipAttempts >= 20)
      await this.cacheManager.set(`ip_locked:${ip}`, '1', lockTtl);
  }
}
