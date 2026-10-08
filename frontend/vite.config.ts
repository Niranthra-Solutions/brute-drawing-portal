import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Dev: `npm run dev` proxies /api to the ASP.NET Core API. Build: output goes straight into the API's wwwroot so one IIS site serves UI + API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:5080', changeOrigin: false } } },
  build: {
    outDir: '../backend/src/DrawingPortal.Api/wwwroot', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 900,
  },
})
