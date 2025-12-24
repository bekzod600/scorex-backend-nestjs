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

    const userId = req.user?.id ?? null;
    const action = `${req.method} ${req.route?.path ?? req.url}`;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire and forget logging, don't block response
          this.pool
            .query(
              `INSERT INTO audit_logs (user_id, action, meta) VALUES ($1, $2, $3)`,
              [
                userId,
                action,
                { ip: req.ip, userAgent: req.headers['user-agent'] },
              ],
            )
            .catch((err) => {
              // Optionally log error, but don't throw
              console.error('Failed to write audit log:', err);
            });
        },
      }),
    );
  }
}
