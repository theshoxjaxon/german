import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

/**
 * Every answer is per person, so none may be cached. POST answers are 200 (as the web app expects,
 * not Nest's default 201) and a handler that returns nothing answers `{ ok: true }`.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    if (res.statusCode === 201) res.status(200);
    return next.handle().pipe(map((value) => (value === undefined && res.statusCode !== 204 ? { ok: true } : value)));
  }
}
