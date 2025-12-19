import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException();
    }

    const [, token] = authHeader.split(' ');
    if (!token) {
      throw new UnauthorizedException();
    }

    const payload = this.jwtService.verify<{ sub: string; role: string }>(
      token,
    );

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    return true;
  }
}
