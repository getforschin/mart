import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@mart/app/styles.css',
        replacement: path.resolve(__dirname, '../../packages/mart-app/src/styles/mart-app.css'),
      },
      {
        find: '@mart/app',
        replacement: path.resolve(__dirname, '../../packages/mart-app/src'),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
