import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
import { copy, copySync, emptyDir, emptyDirSync, remove } from 'fs-extra/esm'
import { name } from '../package.json'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const { LOCALAPPDATA } = process.env

if (!LOCALAPPDATA) {
  // eslint-disable-next-line no-console
  console.log(`none "LOCALAPPDATA"`)
  process.exit(0)
}
const watchDir = join(__dirname, '..', 'dist')

const gamePath = join(LOCALAPPDATA, '/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang')
const development_behavior_packs = join(gamePath, 'development_behavior_packs')
const development_resource_packs = join(gamePath, 'development_resource_packs')

const srcDirB = join(watchDir, 'behavior_pack')
const srcDirR = join(watchDir, 'resource_pack')
const destDirB = join(development_behavior_packs, name)
const destDirR = join(development_resource_packs, name)

async function initialBuild() {
  try {
    await new Promise(r => setTimeout(r, 1000))
    await Promise.all([emptyDir(destDirB), emptyDir(destDirR)])
    await Promise.all([copy(srcDirB, destDirB), copy(srcDirR, destDirR)])
    // eslint-disable-next-line no-console
    console.log('Initial build completed.')
  }
  catch (err) {
    console.error('Initial build failure:', err)
  }
}

async function updateFileOrDir(srcPath: string) {
  try {
    const destPathB = srcPath.replace(srcDirB, destDirB)
    const destPathR = srcPath.replace(srcDirR, destDirR)

    if (srcPath.startsWith(srcDirB)) {
      await copy(srcPath, destPathB)
    }
    if (srcPath.startsWith(srcDirR)) {
      await copy(srcPath, destPathR)
    }

    // eslint-disable-next-line no-console
    console.log(`Updated: ${srcPath}`)
  }
  catch (err) {
    console.error(`Update failed for ${srcPath}:`, err)
  }
}

async function removeFileOrDir(srcPath: string) {
  try {
    const destPathB = srcPath.replace(srcDirB, destDirB)
    const destPathR = srcPath.replace(srcDirR, destDirR)

    if (srcPath.startsWith(srcDirB)) {
      await remove(destPathB)
    }
    if (srcPath.startsWith(srcDirR)) {
      await remove(destPathR)
    }

    // eslint-disable-next-line no-console
    console.log(`Removed: ${srcPath}`)
  }
  catch (err) {
    console.error(`Remove failed for ${srcPath}:`, err)
  }
}
export async function startSync() {
  await initialBuild()
  const watcher = chokidar.watch(watchDir, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 10,
    },
  })

  watcher
    .on('change', updateFileOrDir)
    .on('add', updateFileOrDir)
    .on('addDir', updateFileOrDir)
    .on('unlink', removeFileOrDir)
    .on('unlinkDir', removeFileOrDir)
    .on('error', error => console.error(`Watcher error: ${error}`))
    .on('ready', () => {
      // eslint-disable-next-line no-console
      console.log('Initial scan complete. Ready for changes')
    })
}
