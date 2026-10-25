import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

const isVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  output: 'server',
  adapter: isVercel
    ? vercel()
    : node({
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
