import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 共有用デモ（Artifact）向けビルドでは相対パスで資産を読み込む
  base: process.env.VITE_MEMORY_ROUTER === '1' ? './' : '/',
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
