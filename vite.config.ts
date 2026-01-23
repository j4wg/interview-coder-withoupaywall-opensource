// vite.config.ts
import { defineConfig } from "vite"
import electron from "vite-plugin-electron"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // main.ts
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: process.env.NODE_ENV === "development",
            minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
            rollupOptions: {
              external: ["electron"]
            }
          }
        }
      },
      {
        // preload.ts
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: process.env.NODE_ENV === "development",
            minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
            rollupOptions: {
              external: ["electron"]
            }
          }
        }
      }
    ])
  ],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 54321,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-toast', '@radix-ui/react-label', '@radix-ui/react-slot'],
          'icons': ['lucide-react']
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
