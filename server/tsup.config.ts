import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/app.ts', 'src/config/db.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
});
