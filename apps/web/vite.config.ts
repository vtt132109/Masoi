import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const serverUrl = process.env.VITE_SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: serverUrl, ws: true },
      '/healthz': serverUrl,
    },
  },
  build: { sourcemap: false, target: 'es2022' },
});
