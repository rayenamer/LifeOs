import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dbApi } from './server/db-api.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      // Same database API as server.mjs, so `npm run dev` also saves to data/lifeos.sqlite.
      name: 'lifeos-db-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => void dbApi(req, res, next));
      },
    },
  ],
  server: { port: 4300, host: '127.0.0.1' },
  preview: { port: 4300, host: '127.0.0.1' },
});
