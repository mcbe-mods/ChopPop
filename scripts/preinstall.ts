import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const BPmanifestPath = join(__dirname, '..', 'public/behavior_pack/manifest.json')
const RPmanifestPath = join(__dirname, '..', 'public/resource_pack/manifest.json')

const BP_UUID = crypto.webcrypto.randomUUID()
const RP_UUID = crypto.webcrypto.randomUUID()

if (!existsSync(BPmanifestPath)) {
  mkdirSync(parse(BPmanifestPath).dir, { recursive: true })
  mkdirSync(parse(RPmanifestPath).dir, { recursive: true })

  const BP_manifest_context = {
    format_version: 2,
    header: {
      description: 'pack.description',
      name: 'pack.name',
      uuid: BP_UUID,
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        description: 'JavaScript module code',
        language: 'javascript',
        type: 'script',
        uuid: crypto.webcrypto.randomUUID(),
        version: [1, 0, 0],
        entry: 'scripts/main.js',
      },
    ],
    dependencies: [
      {
        module_name: '@minecraft/server',
        version: '1.11.0',
      },
      {
        uuid: RP_UUID,
        version: [1, 0, 0],
      },
    ],
    metadata: {
      authors: ['Lete114'],
      license: 'GPL-2.0',
      url: 'https://github.com/mcbe-mods',
    },
  }

  const RP_manifest_context = {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: RP_UUID,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [
      {
        type: 'resources',
        version: [1, 0, 0],
        uuid: crypto.webcrypto.randomUUID(),
      },
    ],
    dependencies: [
      {
        uuid: BP_UUID,
        version: [1, 0, 0],
      },
    ],
  }

  writeFileSync(BPmanifestPath, JSON.stringify(BP_manifest_context, null, 2))
  writeFileSync(RPmanifestPath, JSON.stringify(RP_manifest_context, null, 2))
}
