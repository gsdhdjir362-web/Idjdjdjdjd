const mcServer = require('flying-squid');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const { mineflayer: viewer } = require('prismarine-viewer');

console.log('🚀 در حال ساخت مپ و سرور لوکال روی گیت‌هاب...');

// ۱. ساخت سرور داخلی با غیرفعال کردن پلاگین هدر برای جلوگیری از کرش
const server = mcServer.createMCServer({
  'motd': 'Local Test Server',
  'port': 25565,
  'max-players': 10,
  'online-mode': false,
  'logging': false,
  'gameMode': 1,
  'difficulty': 1,
  'worldFolder': 'world',
  'version': '1.16.5',
  'plugins': {},
  'modpe': false,
  'header': { 'header': '', 'footer': '' } // مقداردهی اولیه برای جلوگیری از ارور undefined
});

// ۲. ورود بات به سرور ساخته شده بعد از ۵ ثانیه (زمان بیشتر برای لود کامل سرور)
setTimeout(() => {
  console.log('🤖 در حال ورود بات به مپ داخلی...');
  
  const bot = mineflayer.createBot({
    host: '127.0.0.1',
    port: 25565,
    username: 'pvp_HS',
    version: '1.16.5'
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    console.log('⚔️ بات pvp_HS وارد مپ داخلی شد و آماده است!');
    
    // فعال کردن مانیتورینگ زنده
    viewer(bot, { port: 3000, firstPerson: true });
    console.log('🖥️ سیستم مانیتورینگ روی پورت 3000 استارت خورد.');
  });

  bot.on('error', (err) => console.log('❌ ارور بات:', err));
  bot.on('kicked', (reason) => console.log('🚪 بات کیک شد:', reason));
}, 5000);
