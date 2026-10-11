import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    // Serve vendor/ and world/ directories as static assets during dev
    fs: {
      allow: ['..'],
    },
  },
});
