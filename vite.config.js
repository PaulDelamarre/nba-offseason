/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front 100% statique : les données NBA sont servies depuis public/data/*.json
// (pas de backend). On pourra brancher Supabase plus tard pour la persistance.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
  },
})
