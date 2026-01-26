import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep the original entry names for Chrome extension
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return '[name].js'
        },
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          // Handle HTML files - place them in root
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].[ext]'
          }
          // Handle other assets
          return 'assets/[name].[ext]'
        }
      }
    },
    // Ensure proper format for Chrome extension
    target: 'es2020',
    minify: false, // Disable for debugging during development
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        // Copy manifest.json to dist directory after build
        const manifestSrc = resolve(__dirname, 'manifest.json')
        const manifestDest = resolve(__dirname, 'dist/manifest.json')
        
        fs.copyFileSync(manifestSrc, manifestDest)
        console.log('✓ Copied manifest.json to dist/')
      }
    },
    {
      name: 'copy-popup-html',
      closeBundle() {
        // Copy popup.html to root of dist directory
        const popupSrc = resolve(__dirname, 'dist/src/popup/popup.html')
        const popupDest = resolve(__dirname, 'dist/popup.html')
        
        if (fs.existsSync(popupSrc)) {
          fs.copyFileSync(popupSrc, popupDest)
          console.log('✓ Copied popup.html to dist root/')
        }
      }
    },
    {
      name: 'copy-icons',
      closeBundle() {
        // Copy public directory (icons) to dist
        const publicDir = resolve(__dirname, 'public')
        const distDir = resolve(__dirname, 'dist')
        
        if (fs.existsSync(publicDir)) {
          const copyRecursively = (src: string, dest: string) => {
            if (!fs.existsSync(dest)) {
              fs.mkdirSync(dest, { recursive: true })
            }
            
            fs.readdirSync(src).forEach(file => {
              const srcFile = path.join(src, file)
              const destFile = path.join(dest, file)
              
              if (fs.statSync(srcFile).isDirectory()) {
                copyRecursively(srcFile, destFile)
              } else {
                fs.copyFileSync(srcFile, destFile)
              }
            })
          }
          
          copyRecursively(publicDir, distDir)
          console.log('✓ Copied public assets to dist/')
        }
      }
    }
  ]
})