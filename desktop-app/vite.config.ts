import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  resolve: {
    // Prefer TypeScript sources over any accidental CJS .js siblings in src/
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
  },
});
