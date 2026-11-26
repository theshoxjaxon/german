import type { INestApplication } from '@nestjs/common';
import { json } from 'express';
import { ApiExceptionFilter } from '@api/common/http-exception.filter';
import { ResponseInterceptor } from '@api/common/response.interceptor';

/** Everything main.ts and the tests share, so a test runs the same app as production. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Node closes an idle keep-alive connection after 5 s, which a proxy or load balancer in front (60 s
  // idle) sees as a reset on a request it just sent. Stay open longer than they do.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}

/** Body parser options: JSON whatever the Content-Type says (a beacon may send text/plain), up to the 4.5 MB Vercel allows. */
export const jsonBody = () => json({ type: () => true, limit: '4.5mb' });
