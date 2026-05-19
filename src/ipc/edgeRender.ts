import { IPC } from '@mcbe-mods/ipc'
import { Vector3 } from '@minecraft/server'

const ipc = new IPC({ namespace: 'edge_render' })

export class EdgeRender {
  create(playerIds: string[], locations: Vector3[]) {
    return ipc.invoke<
      { playerIds: string[]; locations: Vector3[] },
      PromiseSettledResult<void>[]
    >('create', { playerIds, locations })
  }

  remove(playerIds: string[]) {
    return ipc.invoke<{ playerIds: string[] }, PromiseSettledResult<void>[]>(
      'remove',
      { playerIds }
    )
  }

  clearAll() {
    return ipc.invoke<null, void>('clearAll', null)
  }
}
