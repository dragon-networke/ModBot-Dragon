import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const adapter = process.env.VERCEL
  ? (await import('@astrojs/vercel/serverless')).default
  : (await import('@astrojs/node')).default({ mode: 'standalone' });

export default defineConfig({
  output: 'server',
  adapter,
  vite: {
    plugins: [tailwindcss()],
  },
});