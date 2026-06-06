import { RPC } from '@mcbe-mods/rpc'
import { Discover } from '@mcbe-mods/discover'
import type { Vector3 } from '@minecraft/server'

const EDGE_RENDER_SERVICE = 'edge_render.service'

export class EdgeRender {
  #rpc: RPC | null = null
  #discover: Discover

  constructor() {
    this.#discover = new Discover()
    this.#discover.query<{ rpc: { namespace: string } }>(EDGE_RENDER_SERVICE, (event) => {
      if (event.type === 'service-resolved') {
        this.#rpc?.dispose()
        this.#rpc = new RPC({ namespace: event.service.meta.rpc.namespace })
      } else {
        this.#rpc?.dispose()
        this.#rpc = null
      }
    })
  }

  create(playerIds: string[], locations: Vector3[]) {
    if (!this.#rpc) return Promise.resolve([] as PromiseSettledResult<void>[])
    return this.#rpc.invoke<PromiseSettledResult<void>[]>('create', { playerIds, locations })
  }

  remove(playerIds: string[]) {
    if (!this.#rpc) return Promise.resolve([] as PromiseSettledResult<void>[])
    return this.#rpc.invoke<PromiseSettledResult<void>[]>('remove', { playerIds })
  }

  dispose() {
    this.#discover.dispose()
    this.#rpc?.dispose()
    this.#rpc = null
  }
}
