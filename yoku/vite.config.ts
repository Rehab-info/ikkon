/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

/**
 * 本番ビルドにだけ Content-Security-Policy を入れる(開発サーバーはインラインスクリプトを使うため)。
 * connect-src 'self' により、アプリのコードが外部へ通信することをブラウザーが拒否する。
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'"
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "yoku-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<meta charset=\"UTF-8\" />",
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      );
    }
  };
}

// base を相対パスにして、GitHub Pages のサブディレクトリ(/ikkon/yoku/)でもローカルでも動くようにする。
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "YOKU",
        short_name: "YOKU",
        description: "自分を知る。ふたりをもっと知る。",
        lang: "ja",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#FAF9F6",
        theme_color: "#486A64",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
        // 実行時に外部へ取りに行くキャッシュ設定は置かない(外部通信をしない)
        runtimeCaching: []
      }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false
  }
});
