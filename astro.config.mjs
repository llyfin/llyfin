// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Served from the root of a custom domain (public/CNAME), so no `base` is needed.
  site: 'https://llyf.in',
  integrations: [react()],

  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
