import { Controller, Post, Body, Req, HttpCode, HttpStatus, Get, UseGuards, Res } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @ApiOperation({ summary: 'Register new account', description: 'Rate limited: 3 per hour per IP' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: AuthResponseDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, req.ip || '');
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // CSRF Token (Allow JS to read so it can send in X-XSRF-TOKEN header)
    res.cookie('XSRF-TOKEN', Math.random().toString(36).substring(2, 15), {
      httpOnly: false, 
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    const result = await this.authService.refreshToken(refreshToken);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const accessToken = req.cookies['accessToken'] || req.headers.authorization?.split(' ')[1];
    const refreshToken = req.cookies['refreshToken'];
    
    await this.authService.logout(accessToken, refreshToken);
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return { success: true };
  }

  @Post('google')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with Google Auth Token from React' })
  async googleLogin(@Body() body: { accessToken: string; role?: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyGoogleAccessToken(body.accessToken, body.role);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('2fa/generate')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Generate 2FA secret and QR code for the user' })
  async generateTwoFactorSecret(@Req() req: any) {
    return this.authService.generateTwoFactorSecret(req.user.sub, req.user.email);
  }

  @Post('2fa/turn-on')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify code and turn on 2FA' })
  async turnOnTwoFactorAuthentication(@Req() req: any, @Body('twoFactorCode') code: string) {
    return this.authService.turnOnTwoFactorAuthentication(req.user.sub, code);
  }
}
