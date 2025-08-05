import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Set base for GitHub Pages deployment
export default defineConfig({
  base: '/Impact-GPE/',
  plugins: [react()],
})

