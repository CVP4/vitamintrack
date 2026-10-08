import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },

    watch: { awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 } },
  },
  preview: { proxy: { '/api': 'http://127.0.0.1:3001' } },
});
