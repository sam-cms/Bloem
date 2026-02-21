import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['localhost-0.tailb786fe.ts.net', '.tailb786fe.ts.net'],
    proxy: {
      '/prebloom': {
        target: 'http://localhost:3000',  // Dev backend
        changeOrigin: true,
      },
    },
  },
})
