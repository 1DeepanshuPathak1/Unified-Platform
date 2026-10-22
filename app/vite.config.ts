import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset URLs so the build works from any path, including a static file host.
export default defineConfig({
  base: './',
  plugins: [react()]
});
