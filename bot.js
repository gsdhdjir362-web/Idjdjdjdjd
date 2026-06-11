const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const { mineflayer: viewer } = require('prismarine-viewer');

console.log('🤖 در حال تلاش برای اتصال بات به سرور لوکال ماینکرافت...');

const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 25565,
  username: 'pvp_HS',
  version: '1.16.5'
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(pvp);

bot.once('spawn', () => {
  console.log('⚔️ بات pvp_HS وارد سرور لوکال شد و با موفقیت اسپان شد!');
  
  // راه‌اندازی مانیتورینگ سه‌بعدی دید اول شخص بات روی پورت ۳۰۰۰
  viewer(bot, { port: 3000, firstPerson: true });
  console.log('🖥️ سرور مانیتورینگ سه‌بعدی روی پورت 3000 آماده به کار است.');
});

// مدیریت خطاها برای پایداری بات
bot.on('error', (err) => {
  console.log('❌ ارور بات:', err.message);
});

bot.on('kicked', (reason) => {
  console.log('🚪 بات از سرور کیک شد. علت:', reason);
});
