import { calcGameTicks, getRadiusRange, ms2ticks, splitGroups } from '@mcbe-mods/utils'
import type { Block, Dimension, Player, Vector3 } from '@minecraft/server'
import {
  BlockPermutation,
  EntityEquippableComponent,
  EquipmentSlot,
  GameMode,
  ItemDurabilityComponent,
  ItemEnchantableComponent,
  ItemLockMode,
  ItemStack,
  system,
  world
} from '@minecraft/server'
import { MinecraftBlockTypes } from '@minecraft/vanilla-data'
import { Log } from '@mcbe-mods/log'
import { edgeRender } from './ipc'

const log = new Log('ChopPop')

const includes = {
  tags: ['wood'],
  permutations: [
    BlockPermutation.resolve(MinecraftBlockTypes.CrimsonStem),
    BlockPermutation.resolve(MinecraftBlockTypes.WarpedStem),
    BlockPermutation.resolve(MinecraftBlockTypes.CrimsonHyphae),
    BlockPermutation.resolve(MinecraftBlockTypes.WarpedHyphae)
  ],
  leaves: [
    'leaves',
    MinecraftBlockTypes.WarpedWartBlock,
    MinecraftBlockTypes.NetherWartBlock,
    MinecraftBlockTypes.Shroomlight,
    MinecraftBlockTypes.MangroveRoots
  ]
}

function getPlayerMainhand(player: Player) {
  const entityEquippableComponent = player.getComponent(
    EntityEquippableComponent.componentId
  ) as EntityEquippableComponent
  return entityEquippableComponent.getEquipmentSlot(EquipmentSlot.Mainhand)
}

function isWoodBlock(block: Block) {
  const { tags, permutations } = includes
  const typeId = block.type.id
  return (
    // no stripped wood
    !typeId.includes('stripped_') &&
    (tags.some((tag) => block.hasTag(tag)) ||
      permutations.some((p) => block.permutation.type.id === p.type.id))
  )
}

function isCuttableBlock(player: Player, block: Block) {
  const typeId = block.type.id
  try {
    return (
      player.isSneaking &&
      getPlayerMainhand(player)?.hasTag('is_axe') &&
      isWoodBlock(block) &&
      isTree(player.dimension, block.location, typeId)
    )
  } catch {
    return false
  }
}

interface WoodLocations {
  woods: Vector3[]
  leaves: Vector3[]
}
function getWoodLocations(
  dimension: Dimension,
  location: Vector3,
  typeId: string
) {
  const visited: Set<string> = new Set()
  const locations: WoodLocations = {
    woods: [],
    leaves: []
  }

  const vector3s = getRadiusRange(location)

  for (const vector3 of vector3s) {
    const pos = JSON.stringify(vector3)

    if (visited.has(pos)) {
      continue
    }

    visited.add(pos)
    const block = dimension.getBlock(vector3)
    if (!block) {
      continue
    }

    const newTypeId = block.typeId

    if (newTypeId === typeId && isWoodBlock(block)) {
      locations.woods.push(vector3)
      vector3s.push(...getRadiusRange(block.location))
    }
    if (includes.leaves.some((i) => block.typeId.includes(i))) {
      locations.leaves.push(vector3)
    }
  }

  const woods = locations.woods.sort((a, b) => a.y - b.y)
  const leaves = locations.leaves.sort((a, b) => a.y - b.y)
  return { woods, leaves }
}

function isTree(
  dimension: Dimension,
  location: Vector3,
  currentBreakBlockTypeId: string
) {
  const locations = getWoodLocations(
    dimension,
    location,
    currentBreakBlockTypeId
  )

  const { leaves } = includes
  for (const location of locations.woods) {
    const blocksLocation = getRadiusRange(location)
    const is = blocksLocation.some((block) => {
      const typeId = dimension.getBlock(block)?.typeId
      if (!typeId) {
        return false
      }

      return leaves.some((item) => typeId.includes(item))
    })
    if (is) {
      return true
    }
  }

  return false
}

function isSurvivalPlayer(dimension: Dimension, player: Player) {
  return dimension
    .getPlayers({ gameMode: GameMode.survival })
    .some((p) => p.name === player.name)
}

function consumeDurability(player: Player, locations: WoodLocations) {
  const mainHand = getPlayerMainhand(player)

  try {
    if (!mainHand) {
      return
    }

    mainHand.lockMode = ItemLockMode.slot

    const item = mainHand.getItem()

    if (!item) {
      return
    }

    const itemDurability = item.getComponent(
      ItemDurabilityComponent.componentId
    ) as ItemDurabilityComponent
    const enchantments = item.getComponent(
      ItemEnchantableComponent.componentId
    ) as ItemEnchantableComponent

    if (!enchantments || !itemDurability) {
      return
    }

    const unbreaking = enchantments.getEnchantment('unbreaking')?.level || 0
    // https://minecraft.fandom.com/wiki/Unbreaking
    const itemMaxDamage = itemDurability.damage * (1 + unbreaking)
    const itemMaxDurability = itemDurability.maxDurability * (1 + unbreaking)
    const consumeItemMaxDamage = itemMaxDamage + locations.woods.length

    const overproof =
      consumeItemMaxDamage >= itemMaxDurability
        ? consumeItemMaxDamage - itemMaxDurability
        : 0
    if (overproof > 0) {
      locations.woods.splice(-overproof)
    }

    // Set axe damage level
    const damage = Math.ceil((consumeItemMaxDamage * 1) / (1 + unbreaking))
    itemDurability.damage =
      damage > itemDurability.maxDurability
        ? itemDurability.maxDurability
        : damage
    mainHand.setItem(item)
  } catch (error) {
    log.warn('set durability error:', error)
  } finally {
    system.runTimeout(() => {
      if (mainHand) {
        mainHand.lockMode = ItemLockMode.none
      }
    }, calcGameTicks(1000))
  }
}

function treeCut(
  location: Vector3,
  dimension: Dimension,
  locations: WoodLocations
) {
  if (!locations.woods.length) {
    return
  }
  const block = dimension.getBlock(locations.woods[0])!
  const typeId = block.typeId

  for (const location of locations.woods) {
    const block = dimension.getBlock(location)!
    block.setType('air')
  }

  splitGroups(locations.woods.length).forEach((group) => {
    dimension.spawnItem(new ItemStack(typeId, group), location)
  })
}

async function clearLeaves(dimension: Dimension, locations: WoodLocations) {
  const checkBlocks = new Set()
  const batchSize = 5 // Size of each batch
  let counter = 0
  const queue = [...locations.leaves].sort((a, b) => a.y - b.y)

  while (queue.length > 0) {
    const leaves = queue.shift()!
    const key = `${leaves.x},${leaves.y},${leaves.z}`

    if (checkBlocks.has(key)) {
      continue
    }
    checkBlocks.add(key)

    const block = dimension.getBlock(leaves)

    if (block && includes.leaves.some((i) => block.typeId.includes(i))) {
      const isWood = getRadiusRange(block.location, 2).some((v) => {
        const block = dimension.getBlock(v)
        return block && isWoodBlock(block)
      })
      if (isWood) {
        continue
      }

      queue.push(...getRadiusRange(block.location))

      if (counter === batchSize) {
        queue.sort((a, b) => a.y - b.y)
        // Add a short delay to allow the event loop to execute the toggle
        await new Promise<void>((resolve) => system.runTimeout(resolve))
        counter = 0
      }
      counter++

      const vector3 = Object.values(leaves).join(' ')
      const command = `setblock ${vector3} air destroy`
      dimension.runCommandAsync(command)
    }
  }
}

const edgeRenderMap = new Map<string, boolean>()
world.beforeEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { dimension, player, block } = event
    const { location, typeId } = block

    const mainHand = getPlayerMainhand(player)
    const item = mainHand.getItem()
    if (item) {
      const cid = ItemDurabilityComponent.componentId
      const itemDurability = item.getComponent(cid) as
        | ItemDurabilityComponent
        | undefined
      if (!itemDurability) {
        return
      }
      if (itemDurability.damage === itemDurability.maxDurability) {
        return
      }

      if (isCuttableBlock(player, block)) {
        event.cancel = true

        const locations = getWoodLocations(dimension, location, typeId)
        if (!locations.woods.length) {
          return
        }

        const survivalPlayer = isSurvivalPlayer(dimension, player)
        system.runTimeout(() => {
          if (survivalPlayer) {
            consumeDurability(player, locations)
          }
          treeCut(location, dimension, locations)
          edgeRenderMap.set(player.id, false)
          edgeRender
            .remove([player.id])
            .catch((err) => log.error(err.message))
          clearLeaves(dimension, locations)
        })
      }
    }
  } catch (error) {
    const err = error as any
    log.error(err)
    log.error(err && err.stack)
    log.error(err && err.message)
  }
})

world.afterEvents.entityHitBlock.subscribe((event) => {
  const player = event.damagingEntity as Player
  const id = player.id
  const block = event.hitBlock

  if (player.typeId !== 'minecraft:player') {
    return
  }

  if (edgeRenderMap.get(id)) {
    return
  }
  edgeRenderMap.set(id, true)

  if (!isCuttableBlock(player, block)) {
    return
  }

  const locations = getWoodLocations(
    event.damagingEntity.dimension,
    event.hitBlock.location,
    event.hitBlock.typeId
  )
  edgeRender
    .create([id], locations.woods)
    .catch((err) => log.error(err.message))

  system.runTimeout(() => {
    edgeRenderMap.set(id, false)

    edgeRender
      .remove([id])
      .catch((err) => log.error(err.message))
  }, ms2ticks(3000))
})
