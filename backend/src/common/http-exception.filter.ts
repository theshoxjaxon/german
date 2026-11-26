import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Every error leaves as `{ error: "message" }`: the shape the web app already reads. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : Array.isArray((body as { message?: unknown }).message) ? String((body as { message: string[] }).message[0]) : String((body as { message?: unknown }).message ?? exception.message);
      // Extra fields on an object body (e.g. a name) travel along with the message.
      const extra = typeof body === 'object' && body ? Object.fromEntries(Object.entries(body).filter(([k]) => !['message', 'error', 'statusCode'].includes(k))) : {};
      res.status(exception.getStatus()).json({ error: message, ...extra });
      return;
    }
    // Errors from the HTTP layer itself (an unreadable JSON body, a body that is too large) carry their own status.
    const status = Number((exception as { status?: number; statusCode?: number })?.status ?? (exception as { statusCode?: number })?.statusCode);
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: status === 413 ? 'That request is too large.' : 'Bad request.' });
      return;
    }
    this.log.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
