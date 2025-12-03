import path from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import generateSitemap from 'vite-ssg-sitemap'
import Layouts from 'vite-plugin-vue-layouts'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import Inspect from 'vite-plugin-inspect'
import EnvironmentPlugin from 'vite-plugin-environment'
import { Buffer } from 'buffer'

// Make Buffer available globally for Solana libraries
globalThis.Buffer = Buffer

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['import', 'legacy-js-api', 'mixed-decls']
      }
    }
  },
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  define: {
    'process.env': { BROWSER: true },
  },
  esbuild: {
    target: 'esnext',
    keepNames: true,
  },
  optimizeDeps: {
    include: ['@coral-xyz/anchor', 'bn.js', '@solana/web3.js', '@solana/spl-token'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  ssr: {
    // Keep these as external during SSR to avoid CommonJS/ESM conflicts
    external: ['@coral-xyz/anchor', '@solana/web3.js', '@solana/spl-token', '@localmoney/sdk'],
  },
  plugins: [
    EnvironmentPlugin('all', { prefix: '' }),
    Vue({
      include: [/\.vue$/],
      reactivityTransform: true,
    }),
    // https://github.com/hannoeru/vite-plugin-pages
    Pages({
      extensions: ['vue'],
    }),
    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),
    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', 'vue-router', 'vue-i18n', 'vue/macros', '@vueuse/head', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
    }),
    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: ['src/ui'],
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      dts: 'src/components.d.ts',
    }),
    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18nPlugin({
      runtimeOnly: true,
      compositionOnly: true,
      include: [path.resolve(__dirname, 'locales/**')],
    }),
    // https://github.com/antfu/vite-plugin-inspect
    // Visit http://localhost:3333/__inspect/ to see the inspector
    Inspect(),
  ],
  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    includedRoutes(paths) {
      // Exclude the bridge route from SSG as it requires browser APIs
      return paths.filter(i => !i.includes('/bridge'))
    },
    onFinished() {
      generateSitemap()
    },
  },
})
