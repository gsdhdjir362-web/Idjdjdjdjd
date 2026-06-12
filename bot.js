// bot.js — Smart Minecraft Speedrun Bot
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalNear } = goals
const Vec3 = require('vec3')

// ====== تنظیمات سرور خودت ======
const SERVER_HOST = 'sgzvzgg.exaroton.me'
const SERVER_PORT = 55094
const BOT_USERNAME = 'pvp_HS'

const bot = mineflayer.createBot({
  host: SERVER_HOST,
  port: SERVER_PORT,
  username: BOT_USERNAME,
  auth: 'offline',     // سرور cracked
  version: false,      // نسخه خودکار تشخیص داده میشه
  checkTimeoutInterval: 60000
})

bot.loadPlugin(pathfinder)

let mcData
let craftingTableBlock = null
let furnaceBlock = null

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log('[BOT]', ...a)

// ====== مدیریت خطا و رویدادها ======
process.on('unhandledRejection', e => log('UNHANDLED', e?.message))
process.on('uncaughtException', e => log('UNCAUGHT', e?.message))
bot.on('error', e => log('ERROR', e.message))
bot.on('kicked', r => log('KICKED:', JSON.stringify(r)))
bot.on('end', () => { log('Disconnected. Exit in 3s.'); setTimeout(() => process.exit(0), 3000) })
bot.on('messagestr', m => log('CHAT:', m))
bot.on('login', () => log(`Connected to ${SERVER_HOST}:${SERVER_PORT} as ${BOT_USERNAME}`))

// =========================================================
//                   AUTO SURVIVAL
// =========================================================
function startAutoEat () {
  setInterval(async () => {
    try {
      if (!bot.entity || bot.food >= 18) return
      const food = bot.inventory.items().find(i =>
        /cooked|bread|apple|carrot|baked_potato|melon_slice/.test(i.name)) ||
        bot.inventory.items().find(i => /beef|porkchop|mutton|chicken|cod|salmon/.test(i.name))
      if (food) {
        await bot.equip(food, 'hand')
        await bot.consume()
        log('Ate', food.name)
      }
    } catch (e) {}
  }, 4000)
}

const HOSTILES = ['zombie', 'skeleton', 'spider', 'cave_spider', 'creeper',
  'witch', 'husk', 'stray', 'zombie_villager', 'drowned', 'pillager',
  'vindicator', 'blaze', 'phantom', 'slime', 'magma_cube', 'silverfish',
  'zombified_piglin', 'wither_skeleton', 'ghast', 'hoglin', 'piglin_brute']

async function equipBestWeapon () {
  const order = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword',
    'golden_sword', 'wooden_sword', 'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe']
  for (const name of order) {
    const w = bot.inventory.items().find(i => i.name === name)
    if (w) { await bot.equip(w, 'hand').catch(() => {}); return }
  }
}

// فایت هوشمند: کم‌خونی → فرار، کریپر → فاصله، بقیه → حمله
function startAutoDefend () {
  setInterval(async () => {
    try {
      if (!bot.entity) return

      if (bot.health <= 6) {
        const threat = bot.nearestEntity(e =>
          HOSTILES.includes(e.name) && e.position.distanceTo(bot.entity.position) < 9)
        if (threat) {
          const away = bot.entity.position.minus(threat.position).normalize().scaled(12)
          const flee = bot.entity.position.plus(away)
          bot.pathfinder.setGoal(new GoalNear(flee.x, flee.y, flee.z, 1))
        }
        return
      }

      const creeper = bot.nearestEntity(e =>
        e.name === 'creeper' && e.position.distanceTo(bot.entity.position) < 6)
      if (creeper && creeper.position.distanceTo(bot.entity.position) < 3.5) {
        const away = bot.entity.position.minus(creeper.position).normalize().scaled(6)
        const flee = bot.entity.position.plus(away)
        bot.pathfinder.setGoal(new GoalNear(flee.x, flee.y, flee.z, 1))
        return
      }

      const hostile = bot.nearestEntity(e =>
        HOSTILES.includes(e.name) && e.position.distanceTo(bot.entity.position) < 6)
      if (hostile) {
        await equipBestWeapon()
        if (hostile.position.distanceTo(bot.entity.position) > 3) {
          bot.pathfinder.setGoal(new GoalNear(
            hostile.position.x, hostile.position.y, hostile.position.z, 2))
        }
        await bot.lookAt(hostile.position.offset(0, hostile.height * 0.8, 0))
        bot.attack(hostile)
      }
    } catch (e) {}
  }, 600)
}

// =========================================================
//                       MOVEMENT
// =========================================================
async function safeGoTo (pos, range = 2, timeoutMs = 45000) {
  const goal = new GoalNear(pos.x, pos.y, pos.z, range)
  return Promise.race([
    bot.pathfinder.goto(goal),
    new Promise((_, rej) => setTimeout(() => rej(new Error('path timeout')), timeoutMs))
  ])
}
async function tryGoTo (pos, range = 2) {
  try { await safeGoTo(pos, range); return true } catch (e) { log('  path:', e.message); return false }
}
async function exploreRandom (dist) {
  const a = Math.random() * Math.PI * 2
  const t = bot.entity.position.offset(Math.cos(a) * dist, 0, Math.sin(a) * dist)
  await tryGoTo(t, 3)
}

async function equipBestTool (block) {
  const picks = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe']
  const axes = ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe']
  const pool = (block && block.name.endsWith('_log')) ? axes : picks
  for (const name of pool) {
    const t = bot.inventory.items().find(i => i.name === name)
    if (t) { await bot.equip(t, 'hand').catch(() => {}); return }
  }
}

async function digDown (depth) {
  for (let i = 0; i < depth; i++) {
    const below = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    if (!below || below.name === 'air' || below.name === 'bedrock') break
    try { await equipBestTool(below); await bot.dig(below); await sleep(200) } catch (e) { break }
  }
}

// =========================================================
//                       GATHERING
// =========================================================
async function gatherAnyLogsSmart (count) {
  const logIds = mcData.blocksArray.filter(b => b.name.endsWith('_log')).map(b => b.id)
  let collected = 0; let explores = 0
  while (collected < count && explores < 25) {
    const block = bot.findBlock({ matching: logIds, maxDistance: 64 })
    if (!block) { await exploreRandom(25); explores++; continue }
    if (!await tryGoTo(block.position, 2)) { explores++; continue }
    try {
      await equipBestTool(block)
      await bot.dig(bot.blockAt(block.position))
      collected++; log('Logs', collected, '/', count)
    } catch (e) { log('  dig:', e.message) }
    await sleep(250)
  }
  if (collected === 0) throw new Error('no logs found')
}

async function gatherAnyBlock (names, count) {
  const ids = names.map(n => mcData.blocksByName[n]?.id).filter(Boolean)
  if (!ids.length) throw new Error('unknown blocks: ' + names.join(','))
  let collected = 0; let explores = 0
  while (collected < count && explores < 40) {
    const block = bot.findBlock({ matching: ids, maxDistance: 64 })
    if (!block) {
      if (names.some(n => /iron|diamond|coal|gold|redstone|lapis/.test(n))) await digDown(6)
      else await exploreRandom(20)
      explores++; continue
    }
    if (!await tryGoTo(block.position, 2)) { explores++; continue }
    try {
      await equipBestTool(block)
      await bot.dig(bot.blockAt(block.position))
      collected++; log(names[0], collected, '/', count)
    } catch (e) { log('  dig:', e.message) }
    await sleep(250)
  }
  if (collected === 0) throw new Error('none of ' + names.join(','))
}

// =========================================================
//          CRAFTING — باگ کرافتینگ‌تیبل اینجا حل شده
// =========================================================
async function craftPlanks (targetCount) {
  let made = 0; let guard = 0
  while (made < targetCount && guard < 64) {
    guard++
    const logItem = bot.inventory.items().find(it => it.name.endsWith('_log'))
    if (!logItem) break
    const plankName = logItem.name.replace('_log', '_planks')
    const plankItem = mcData.itemsByName[plankName]
    if (!plankItem) break
    const r = bot.recipesFor(plankItem.id, null, 1, null)
    if (!r.length) break
    await bot.craft(r[0], 1, null).catch(() => {})
    made += 4
  }
  log('Planks ~', made)
}

async function craftSticks (count) {
  const stick = mcData.itemsByName.stick
  let made = 0; let guard = 0
  while (made < count && guard < 32) {
    guard++
    const planks = bot.inventory.items().find(it => it.name.endsWith('_planks'))
    if (!planks) break
    const r = bot.recipesFor(stick.id, null, 1, null)
    if (!r.length) break
    await bot.craft(r[0], 1, null).catch(() => {})
    made += 4
  }
  log('Sticks ~', made)
}

// میز کاردستی — تشخیص نوع چوب (باگ‌فیکس اصلی)
async function craftCraftingTable () {
  if (bot.inventory.items().find(i => i.name === 'crafting_table')) return
  let plank = bot.inventory.items().find(i => i.name.endsWith('_planks'))
  if (!plank || plank.count < 4) {
    await craftPlanks(8)
    plank = bot.inventory.items().find(i => i.name.endsWith('_planks'))
  }
  if (!plank) throw new Error('no planks for table')
  const tableItem = mcData.itemsByName.crafting_table
  const recipes = bot.recipesFor(tableItem.id, null, 1, null)
  if (!recipes.length) throw new Error('no table recipe (plank type mismatch)')
  await bot.craft(recipes[0], 1, null)
  log('Crafted crafting_table')
}

async function craftItemAtTable (name) {
  const item = mcData.itemsByName[name]
  if (!item) throw new Error('unknown: ' + name)
  if (bot.inventory.items().find(i => i.name === name)) return

  let table = (craftingTableBlock && bot.blockAt(craftingTableBlock.position)?.name === 'crafting_table')
    ? craftingTableBlock
    : bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 32 })

  if (!table) { await craftCraftingTable(); await placeCraftingTable(); table = craftingTableBlock }
  if (!table) throw new Error('no crafting table')

  await tryGoTo(table.position, 2)
  const recipes = bot.recipesFor(item.id, null, 1, table)
  if (!recipes.length) throw new Error('no recipe for ' + name + ' (missing materials?)')
  await bot.craft(recipes[0], 1, table)
  log('Crafted', name)
}

// =========================================================
//                       PLACING
// =========================================================
async function placeBlockSafely (itemName) {
  const item = bot.inventory.items().find(i => i.name === itemName)
  if (!item) throw new Error('no ' + itemName)
  await bot.equip(item, 'hand')
  const offsets = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [2, 0, 0], [0, 0, 2]]
  for (const [dx, dy, dz] of offsets) {
    const target = bot.entity.position.floored().offset(dx, dy, dz)
    const below = bot.blockAt(target.offset(0, -1, 0))
    const at = bot.blockAt(target)
    if (below && below.boundingBox === 'block' && at && at.name === 'air') {
      try {
        await bot.lookAt(target.offset(0.5, 0.5, 0.5))
        await bot.placeBlock(below, new Vec3(0, 1, 0))
        return bot.blockAt(target)
      } catch (e) {}
    }
  }
  throw new Error('no spot for ' + itemName)
}
async function placeCraftingTable () { craftingTableBlock = await placeBlockSafely('crafting_table'); log('Placed table') }
async function placeFurnace () { furnaceBlock = await placeBlockSafely('furnace'); log('Placed furnace') }

// =========================================================
//                       SMELTING
// =========================================================
async function smeltItems (oreNames, count, fuelName) {
  const f = (furnaceBlock && bot.blockAt(furnaceBlock.position)?.name === 'furnace')
    ? furnaceBlock
    : bot.findBlock({ matching: mcData.blocksByName.furnace.id, maxDistance: 32 })
  if (!f) throw new Error('no furnace')
  await tryGoTo(f.position, 2)
  const furnace = await bot.openFurnace(f)
  try {
    const ore = bot.inventory.items().find(i => oreNames.includes(i.name))
    const fuel = bot.inventory.items().find(i => i.name === fuelName)
    if (!ore || !fuel) throw new Error('missing smelt resources')
    const amount = Math.min(ore.count, count)
    await furnace.putFuel(fuel.type, null, Math.ceil(amount / 8) + 1)
    await furnace.putInput(ore.type, null, amount)
    const start = Date.now()
    while (Date.now() - start < 90000) {
      await sleep(1500)
      if (furnace.outputItem() && furnace.outputItem().count >= amount) break
    }
    try { await furnace.takeOutput() } catch (e) {}
  } finally { furnace.close() }
}

// =========================================================
//                       FOOD
// =========================================================
async function collectFood (count) {
  const animals = ['pig', 'cow', 'sheep', 'chicken', 'rabbit']
  const start = Date.now()
  while (Date.now() - start < 90000) {
    const meats = bot.inventory.items().filter(i => /porkchop|beef|mutton|chicken|rabbit/.test(i.name))
    if (meats.reduce((s, m) => s + m.count, 0) >= count) return
    const a = bot.nearestEntity(e => animals.includes(e.name) &&
      e.position.distanceTo(bot.entity.position) < 32)
    if (!a) { await exploreRandom(20); continue }
    await equipBestWeapon()
    await tryGoTo(a.position, 2)
    for (let k = 0; k < 6 && a.isValid; k++) {
      await bot.lookAt(a.position.offset(0, a.height * 0.7, 0))
      bot.attack(a)
      await sleep(500)
    }
  }
}

// =========================================================
//                   SPEEDRUN ORCHESTRATION
// =========================================================
async function safeStep (name, fn, critical = false) {
  log('STEP:', name)
  try { await fn(); log('OK:', name); return true }
  catch (e) { log('FAIL:', name, '-', e.message); if (critical) throw e; return false }
}

async function runSpeedrun () {
  await safeStep('gather logs', () => gatherAnyLogsSmart(8))
  await safeStep('craft planks', () => craftPlanks(24))
  await safeStep('craft sticks', () => craftSticks(8))
  await safeStep('craft table', () => craftCraftingTable())
  await safeStep('place table', () => placeCraftingTable())
  await safeStep('wooden pickaxe', () => craftItemAtTable('wooden_pickaxe'))
  await safeStep('wooden axe', () => craftItemAtTable('wooden_axe'))
  await safeStep('gather stone', () => gatherAnyBlock(['stone', 'cobblestone'], 16))
  await safeStep('stone pickaxe', () => craftItemAtTable('stone_pickaxe'))
  await safeStep('stone sword', () => craftItemAtTable('stone_sword'))
  await safeStep('stone axe', () => craftItemAtTable('stone_axe'))
  await safeStep('furnace', () => craftItemAtTable('furnace'))
  await safeStep('place furnace', () => placeFurnace())
  await safeStep('food', () => collectFood(6))
  await safeStep('coal', () => gatherAnyBlock(['coal_ore', 'deepslate_coal_ore'], 5))
  await safeStep('iron', () => gatherAnyBlock(['iron_ore', 'deepslate_iron_ore'], 9))
  await safeStep('smelt iron', () => smeltItems(['raw_iron', 'iron_ore'], 7, 'coal'))
  await safeStep('iron pickaxe', () => craftItemAtTable('iron_pickaxe'))
  await safeStep('iron sword', () => craftItemAtTable('iron_sword'))
  await safeStep('diamond', () => gatherAnyBlock(['diamond_ore', 'deepslate_diamond_ore'], 3))
  await safeStep('diamond sword', () => craftItemAtTable('diamond_sword'))
  await safeStep('diamond pickaxe', () => craftItemAtTable('diamond_pickaxe'))
  log('🏆 Speedrun chain finished (full or partial). Staying connected.')
}

// =========================================================
//                       SPAWN
// =========================================================
bot.once('spawn', async () => {
  log('Spawned in world')
  mcData = require('minecraft-data')(bot.version)
  const m = new Movements(bot, mcData)
  m.canDig = true
  m.allow1by1towers = true
  m.allowParkour = true
  m.allowSprinting = true
  bot.pathfinder.setMovements(m)

  startAutoEat()
  startAutoDefend()

  await sleep(3000)
  await runSpeedrun()
})
