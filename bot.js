const mcServer = require('flying-squid');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const { mineflayer: viewer } = require('prismarine-viewer');

console.log('🚀 در حال ساخت مپ و سرور لوکال روی گیت‌هاب...');

// ۱. ساخت سرور داخلی
const server = mcServer.createMCServer({
  'motd': 'Local Test Server',
  'port': 25565,
  'max-players': 10,
  'online-mode': false,
  'logging': false, // لاگ‌های سرور رو خاموش کردیم تا شلوغ نشه
  'gameMode': 1,
  'difficulty': 1,
  'worldFolder': 'world',
  'version': '1.16.5'
});

// ۲. ورود بات به سرور ساخته شده بعد از ۲ ثانیه
setTimeout(() => {
  console.log('🤖 در حال ورود بات به مپ داخلی...');
  
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'PvP_HS'
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    console.log('⚔️ بات PvP_HS وارد مپ داخلی شد و آماده است!');
    viewer(bot, { port: 3000, firstPerson: true });
  });

  bot.on('error', (err) => console.log('❌ ارور بات:', err));
}, 2000);
