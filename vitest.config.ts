import path from 'node:path';
import { defineConfig } from 'vitest/config';

// The web app's tests. The API (backend/) has its own package and its own `npm test`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { exclude: ['node_modules/**', 'backend/**', '.next/**'] },
});
