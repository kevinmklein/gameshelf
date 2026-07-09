import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Honor a PORT env var when one is provided (e.g. by a preview harness);
  // falls back to Vite's default 5173 for a normal `npm run dev`.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
