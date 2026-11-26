import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Only the load test; it takes about a minute and is not part of `npm test`.
export default defineConfig({
  plugins: [swc.vite({ jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } } })],
  resolve: { alias: { '@api': path.resolve(import.meta.dirname, '../src'), '@': path.resolve(import.meta.dirname, '../../src') } },
  test: { include: ['loadtest/**/*.load.ts'], disableConsoleIntercept: true, root: path.resolve(import.meta.dirname, '..'), testTimeout: 300_000, hookTimeout: 120_000 },
});
