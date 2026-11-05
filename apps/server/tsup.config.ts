import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Gộp các package nội bộ (chỉ có mã nguồn TS) vào bản build.
  noExternal: [/^@masoi\//],
});
