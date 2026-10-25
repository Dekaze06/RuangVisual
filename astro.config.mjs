import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  security: {
    checkOrigin: false,
  },
  server: {
    port: 4321,
    host: true,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
    ssr: {
      external: ['@electric-sql/pglite', 'pg'],
    },
  },
});
