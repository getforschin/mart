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
    alias: [
      {
        find: '@mart/app/styles.css',
        replacement: path.resolve(__dirname, '../packages/mart-app/src/styles/mart-app.css'),
      },
      {
        find: '@mart/app',
        replacement: path.resolve(__dirname, '../packages/mart-app/src'),
      },
    ],
  },
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    // Fail loudly if an old Vite (e.g. from ~/mart-app) is still holding 5175.
    // Electron loads http://localhost:5175 — a silent fallback to 5176 serves the wrong UI.
    strictPort: true,
  },
});
