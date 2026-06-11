const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const express = require('express');
const app = express();
const http = require('http').createServer(app);

// تنظیمات ربات و سرور شما
const botConfig = {
  host: 'bdhdhdjom.exaroton.me',
  port: 28588,
  username: 'pvp_HS'
};

let botStatus = {
  online: false,
  health: 20,
  food: 20,
  position: { x: 0, y: 0, z: 0 },
  inventory: [],
  logs: []
};

function addLog(message) {
  const time = new Date().toLocaleTimeString();
  const logMsg = `[${time}] ${message}`;
  console.log(logMsg);
  botStatus.logs.push(logMsg);
  if (botStatus.logs.length > 50) botStatus.logs.shift();
}

let bot = null;

function createBot() {
  addLog(`🔄 در حال تلاش برای اتصال به سرور اگزوراتون (${botConfig.host})...`);
  
  bot = mineflayer.createBot({
    host: botConfig.host,
    port: botConfig.port,
    username: botConfig.username
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    botStatus.online = true;
    addLog(`⚔️ بات PvP_HS با موفقیت وارد سرور شد!`);
    
    // موقعیت اولیه
    botStatus.position = bot.entity.position;
    
    // بروزرسانی دائم وضعیت بات
    bot.on('physicTick', () => {
      botStatus.position = bot.entity.position;
      botStatus.health = bot.health;
      botStatus.food = bot.food;
    });

    bot.on('chat', (username, message) => {
      addLog(`💬 [چت] ${username}: ${message}`);
      
      // اگر چت حاوی دستور بود، اینجا لاجیک مینویسیم
      if (message.startsWith('!status')) {
        bot.chat('من آنلاین و در حال مانیتورینگ هستم!');
      }
    });
  });

  bot.on('error', (err) => {
    addLog(`❌ ارور: ${err.message}`);
  });

  bot.on('end', () => {
    botStatus.online = false;
    addLog('🚪 بات از سرور خارج شد. تلاش مجدد برای اتصال در ۱۰ ثانیه دیگر...');
    setTimeout(createBot, 10000);
  });
}

// شروع به کار بات
createBot();

// داشبورد وب اختصاصی روی پورت 3000
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>داشبورد مدیریت ربات PvP_HS</title>
      <style>
        body { font-family: Tahoma, Arial, sans-serif; background-color: #1a1a1a; color: #fff; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { background: #2e7d32; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { background: #2d2d2d; padding: 20px; border-radius: 8px; border: 1px solid #444; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .card h3 { margin-top: 0; color: #81c784; border-bottom: 1px solid #444; padding-bottom: 10px; }
        .status-online { color: #4caf50; font-weight: bold; }
        .status-offline { color: #f44336; font-weight: bold; }
        .log-box { background: #000; color: #00ff00; font-family: monospace; padding: 15px; border-radius: 5px; height: 300px; overflow-y: auto; white-space: pre-wrap; }
        .stat-val { font-size: 1.2em; font-weight: bold; color: #ffd54f; }
      </style>
      <script>
        // ریلود خودکار برای دریافت آخرین اطلاعات لایو
        setInterval(() => {
          window.location.reload();
        }, 3000);
      </script>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 کنترل پنل و مانیتورینگ ربات PvP_HS</h1>
          <p>وضعیت لحظه‌ای و مانیتورینگ لایو عملکرد ربات در سرور ماینکرافت</p>
        </div>
        
        <div class="grid">
          <div class="card">
            <h3>📡 وضعیت اتصال</h3>
            <p>وضعیت: <span class="${botStatus.online ? 'status-online' : 'status-offline'}">${botStatus.online ? 'متصل به سرور اگزوراتون' : 'آفلاین / در حال اتصال'}</span></p>
            <p>آدرس سرور: <span class="stat-val">${botConfig.host}:${botConfig.port}</span></p>
          </div>
          
          <div class="card">
            <h3>❤️ علائم حیاتی</h3>
            <p>میزان سلامتی (HP): <span class="stat-val">${botStatus.health} / 20</span></p>
            <p>میزان غذا (Food): <span class="stat-val">${botStatus.food} / 20</span></p>
          </div>

          <div class="card">
            <h3>📍 موقعیت مکانی</h3>
            <p>X: <span class="stat-val">${Math.round(botStatus.position.x)}</span></p>
            <p>Y: <span class="stat-val">${Math.round(botStatus.position.y)}</span></p>
            <p>Z: <span class="stat-val">${Math.round(botStatus.position.z)}</span></p>
          </div>
        </div>

        <div class="card" style="margin-bottom: 20px;">
          <h3>📋 اینونتوری ربات (کوله پشتی)</h3>
          <p style="color: #aaa; font-style: italic;">در حال بارگذاری لایو آیتم‌ها...</p>
        </div>

        <div class="card">
          <h3>📜 لاگ‌های زنده ربات (کنسول مانیتورینگ)</h3>
          <div class="log-box" id="logs">${botStatus.logs.reverse().join('\n')}</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

http.listen(3000, () => {
  console.log('🖥️ سرور مانیتورینگ وب روی پورت 3000 راه‌اندازی شد.');
});
