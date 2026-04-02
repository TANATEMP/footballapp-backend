// src/modules/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
<<<<<<< HEAD
    private configService: ConfigService,
    private prisma: PrismaService,
=======
    private readonly configService: ConfigService,
    @InjectModel(User) private readonly userModel: typeof User,
>>>>>>> cdd78b3140b024ca520fb8623c802b6614f08206
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
<<<<<<< HEAD
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
=======
    const user = await this.userModel.findByPk(payload.sub);
    if (!user?.is_active) {
>>>>>>> cdd78b3140b024ca520fb8623c802b6614f08206
      throw new UnauthorizedException();
    }
    return { sub: user.id, email: user.email, role: user.role };
  }
}
