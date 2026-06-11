const mc = require('minecraft-protocol');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const { mineflayer: viewer } = require('prismarine-viewer');

const PORT = 25565;
const VERSION = '1.16.5';

console.log('🚀 در حال راه‌اندازی سرور شبیه‌ساز ماینکرافت روی پورت ' + PORT + '...');

// ۱. ساخت یک سرور شبیه‌ساز ساده ماینکرافت برای لود شدن مپ
const server = mc.createServer({
  'online-mode': false,
  encryption: false,
  host: '127.0.0.1',
  port: PORT,
  version: VERSION,
  maxPlayers: 10
});

server.on('login', (client) => {
  console.log(`👤 بازیکن ${client.username} به سرور شبیه‌ساز وصل شد.`);
  
  // فرستادن پکت‌های حداقلی برای اسپان شدن بات در یک مپ خالی
  client.write('login', {
    entityId: 1,
    isHardcore: false,
    gameMode: 1,
    previousGameMode: 255,
    worldNames: ['minecraft:overworld'],
    dimensionCodec: {
      type: 'compound',
      name: '',
      value: {
        dimension: {
          type: 'list',
          value: {
            type: 'compound',
            value: []
          }
        }
      }
    },
    dimension: 'minecraft:overworld',
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: 10,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: true
  });

  client.write('position', {
    x: 0,
    y: 64,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0,
    teleportId: 1
  });
});

// ۲. متصل کردن بات بعد از لود شدن سرور شبیه‌ساز
setTimeout(() => {
  console.log('🤖 در حال متصل کردن بات PvP_HS به شبیه‌ساز...');
  
  const bot = mineflayer.createBot({
    host: '127.0.0.1',
    port: PORT,
    username: 'pvp_HS',
    version: VERSION
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    console.log('⚔️ بات PvP_HS با موفقیت اسپان شد و آماده کار است!');
    
    // فعال کردن مانیتورینگ دید بات روی پورت ۳۰۰۰
    viewer(bot, { port: 3000, firstPerson: true });
    console.log('🖥️ سرور مانیتورینگ سه‌بعدی روی پورت 3000 استارت خورد.');
  });

  bot.on('error', (err) => {
    console.log('❌ ارور بات:', err.message);
  });

  bot.on('kicked', (reason) => {
    console.log('🚪 بات کیک شد:', reason);
  });
}, 2000);
