import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, jsonBody } from './app.setup';
import { floodLimit, securityHeaders } from './common/security';

/** The configured API, not yet listening: `main.ts` listens on a port, `api/index.js` serves it on Vercel. */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', true);
  app.use(securityHeaders, floodLimit(), jsonBody());
  configureApp(app);
  return app;
}
