import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      tap({
        next: () => this.writeLog(req, 'SUCCESS'),
        error: (err) => this.writeLog(req, 'ERROR', err),
      }),
    );
  }

  private writeLog(
    req: AuthenticatedRequest,
    status: 'SUCCESS' | 'ERROR',
    error?: any,
  ) {
    // Agar user yo‘q bo‘lsa (public route) — audit yozmaslik mumkin
    if (!req.user) return;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.socket?.remoteAddress ??
      null;

    const action = `${req.method} ${req.originalUrl}`;

    this.pool
      .query(
        `
        INSERT INTO audit_logs (user_id, action, status, meta)
        VALUES ($1, $2, $3, $4)
        `,
        [
          req.user.id,
          action,
          status,
          {
            ip,
            userAgent: req.headers['user-agent'],
            error: error?.message,
          },
        ],
      )
      .catch(() => {
        // audit log hech qachon appni yiqitmasligi kerak
      });
  }
}
