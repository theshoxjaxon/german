// Vercel entry: serves the API built by `npm run build` (dist/). Plain ESM on purpose, so Vercel
// loads it as written instead of compiling src/ itself. vercel.json sends every /api/* here.
import { createApp } from '../dist/backend/src/bootstrap.js';

let ready;
export default async function handler(req, res) {
  ready ??= createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance();
  });
  (await ready)(req, res);
}
