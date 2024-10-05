
import react from '@vitejs/plugin-react-swc'
import path from "path"
import { defineConfig } from "vite"
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['liquid-sdk']
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    preserveSymlinks: true
  },
  build: {
    commonjsOptions: {
      include: [/liquid-sdk/, /node_modules/]
    }
  }
})