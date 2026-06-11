const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const { mineflayer: viewer } = require('prismarine-viewer');

console.log('در حال اتصال به سرور اگزوراتون...');

const bot = mineflayer.createBot({
  host: 'bdhdhdjom.exaroton.me',
  port: 28588,
  username: 'PvP_HS'
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(pvp);

bot.once('spawn', () => {
  console.log('⚔️ بات PvP_HS با موفقیت وارد سرور شد!');
  
  // راه‌اندازی سیستم مانیتورینگ دید بات
  viewer(bot, { port: 3000, firstPerson: true });
  console.log('🖥️ سرور مانیتورینگ روی پورت 3000 فعال شد.');
});

// مدیریت ارورها برای جلوگیری از کرش ناگهانی اکشن
bot.on('error', (err) => console.log('❌ ارور بات:', err));
bot.on('kicked', (reason) => console.log('🚪 بات از سرور کیک شد:', reason));
