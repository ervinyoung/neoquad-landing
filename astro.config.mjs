import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://neoquadapp.com',
  devToolbar: { enabled: false },
  server: { port: 4321 },
});
