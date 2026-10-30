import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' keeps the built files working from any hosting folder (Firebase Hosting root, local preview, file server).
export default defineConfig({ plugins: [react()], base: './', build: { chunkSizeWarningLimit: 900 } });
