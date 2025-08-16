import { defineConfig } from 'vite'
import { startSync } from './scripts/sync'

export default defineConfig((config) => {
  let flag = true
  return {
    build: {
      lib: {
        entry: 'src/main.ts',
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          // load script path, Note the script path in the manifest.json file
          entryFileNames: 'behavior_pack/scripts/main.js',
        },
        external: ['@minecraft/server'],
      },
    },
    plugins: [
      {
        name: 'sync dist to mc',
        buildEnd() {
          if (config.mode === 'development' && flag) {
            flag = false
            startSync()
          }
        },
      },
    ],
  }
})
