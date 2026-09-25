import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirige /api/* al backend Node.js en el mismo entorno local
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Redirige /ws al WebSocket del backend
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
