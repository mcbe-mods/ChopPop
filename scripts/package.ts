import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import archiver from 'archiver'

import config from '../config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const distPath = join(__dirname, '..', 'dist')
const packPath = join(__dirname, '..', 'pack')
const supportVersion = config.support_version.join('.').replace(/0$/, 'x')
const fileName = `${config.name}-v${config.version}-v${supportVersion}.mcaddon`
const outputZipFile = join(packPath, fileName)

if (!existsSync(distPath)) {
  mkdirSync(distPath)
}
if (!existsSync(packPath)) {
  mkdirSync(packPath)
}

const output = createWriteStream(outputZipFile)
const archive = archiver('zip')

const distPathB = join(distPath, 'behavior_pack')
const distPathR = join(distPath, 'resource_pack')
if (existsSync(distPathB)) {
  archive.directory(distPathB, 'behavior_pack')
}
if (existsSync(distPathR)) {
  archive.directory(distPathR, 'resource_pack')
}

archive.pipe(output)
archive.finalize()
