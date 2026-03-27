import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/omnichain-payments-evm/ui/',
  build: {
    outDir: 'dist',
  },
})
