import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Allow safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Explicit fallback for auth public routes 
    // This is necessary because some public routes (like reset-password) 
    // might be accessed without a prior session/CSRF cookie.
    const publicPrefixes = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/refresh',
      '/api/v1/auth/google',
    ];

    const path = request.path || request.url;
    if (publicPrefixes.some(prefix => path.startsWith(prefix))) {
      return true;
    }

    const csrfCookie = request.cookies?.['XSRF-TOKEN'];
    const csrfHeader = request.headers['x-xsrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('CSRF token mismatch or missing');
    }

    return true;
  }
}
