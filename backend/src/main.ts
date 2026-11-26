import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, jsonBody } from './app.setup';
import { floodLimit, securityHeaders } from './common/security';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', true);
  app.use(securityHeaders, floodLimit(), jsonBody());
  configureApp(app);
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
