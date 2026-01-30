import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  base: './',
  define: {
    // Inject a build-time constant so code can check the target at compile time
    __BROWSER_TARGET__: JSON.stringify('firefox'),
  },
  build: {
    outDir: 'dist-firefox',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return '[name].js'
        },
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].[ext]'
          }
          return 'assets/[name].[ext]'
        },
      },
    },
    target: 'es2020',
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected',
      },
    }),
    {
      name: 'copy-firefox-manifest',
      closeBundle() {
        // Copy Firefox-specific manifest.json to dist-firefox/
        const distDir = resolve(__dirname, 'dist-firefox')
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true })
        }
        const manifestSrc = resolve(__dirname, 'manifest.firefox.json')
        const manifestDest = resolve(distDir, 'manifest.json')

        fs.copyFileSync(manifestSrc, manifestDest)
        console.log('✓ Copied manifest.firefox.json to dist-firefox/')
      },
    },
    {
      name: 'copy-popup-html',
      closeBundle() {
        // Vite puts the popup HTML in dist-firefox/src/popup/ - copy to dist root
        // and fix script paths to be relative to the new location
        const popupSrc = resolve(__dirname, 'dist-firefox/src/popup/index.html')
        const popupDest = resolve(__dirname, 'dist-firefox/popup.html')
        if (fs.existsSync(popupSrc)) {
          let html = fs.readFileSync(popupSrc, 'utf-8')
          // Fix relative paths: ../../popup.js -> ./popup.js
          html = html.replace(/src="\.\.\/\.\.\//g, 'src="./')
          html = html.replace(/href="\.\.\/\.\.\//g, 'href="./')
          fs.writeFileSync(popupDest, html)
          // Remove the nested src/ directory artifact
          fs.rmSync(resolve(__dirname, 'dist-firefox/src'), { recursive: true, force: true })
          console.log('✓ Copied popup.html to dist-firefox root (paths fixed)')
        }
      },
    },
    {
      name: 'copy-icons',
      closeBundle() {
        const publicDir = resolve(__dirname, 'public')
        const distDir = resolve(__dirname, 'dist-firefox')

        if (fs.existsSync(publicDir)) {
          const copyRecursively = (src: string, dest: string) => {
            if (!fs.existsSync(dest)) {
              fs.mkdirSync(dest, { recursive: true })
            }

            fs.readdirSync(src).forEach((file) => {
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
          console.log('✓ Copied public assets to dist-firefox/')
        }
      },
    },
  ],
})
