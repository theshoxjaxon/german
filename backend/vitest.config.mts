import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (not esbuild) so Nest's constructor injection keeps its decorator metadata.
export default defineConfig({
  plugins: [swc.vite({ jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } } })],
  resolve: { alias: { '@api': path.resolve(import.meta.dirname, 'src'), '@': path.resolve(import.meta.dirname, '../src') } },
  test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'], testTimeout: 30_000 },
});
