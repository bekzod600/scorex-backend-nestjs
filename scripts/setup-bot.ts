#!/usr/bin/env npx ts-node

/**
 * Bot Menu Button Setup Script
 *
 * Bu script bir marta ishga tushiriladi - deployment vaqtida.
 * Bot menu button ni WebApp ga bog'laydi.
 *
 * Usage:
 *   npx ts-node scripts/setup-bot.ts
 *
 * Environment variables (required):
 *   TELEGRAM_BOT_TOKEN - Bot token from @BotFather
 *   WEBAPP_URL - Your frontend URL (https://your-app.com)
 */

import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

// .env faylni yuklash
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Optional

async function setupBot() {
  console.log('🤖 ScoreX Bot Setup\n');

  // Validate environment
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set!');
    console.log('   Set it in your .env file');
    process.exit(1);
  }

  if (!WEBAPP_URL) {
    console.error('❌ WEBAPP_URL is not set!');
    console.log('   Set it in your .env file');
    process.exit(1);
  }

  console.log(`📱 WebApp URL: ${WEBAPP_URL}`);
  console.log(
    `🔗 Webhook URL: ${WEBHOOK_URL || 'Not set (manual setup required)'}\n`,
  );

  const bot = new TelegramBot(BOT_TOKEN, { polling: false });

  try {
    // 1. Bot info olish
    const me = await bot.getMe();
    console.log(`✅ Connected to bot: @${me.username} (${me.first_name})`);

    // 2. Menu button sozlash
    console.log('\n📋 Setting up menu button...');
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '📱 Open ScoreX',
        web_app: { url: WEBAPP_URL },
      },
    });
    console.log('✅ Menu button configured');

    // 3. Commands sozlash
    console.log('\n📋 Setting up bot commands...');
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot / Open app' },
      { command: 'help', description: 'Show help message' },
      { command: 'webapp', description: 'Open WebApp' },
    ]);
    console.log('✅ Commands configured');

    // 4. Webhook sozlash (agar URL berilgan bo'lsa)
    if (WEBHOOK_URL) {
      console.log('\n📋 Setting up webhook...');
      await bot.setWebHook(WEBHOOK_URL);
      console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
    }

    // 5. Webhook info olish
    const webhookInfo = await bot.getWebHookInfo();
    console.log('\n📊 Current Webhook Info:');
    console.log(`   URL: ${webhookInfo.url || 'Not set'}`);
    console.log(`   Pending updates: ${webhookInfo.pending_update_count}`);
    if (webhookInfo.last_error_message) {
      console.log(`   ⚠️ Last error: ${webhookInfo.last_error_message}`);
    }

    console.log('\n✅ Bot setup completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Make sure your backend is running');
    console.log('   2. Make sure your frontend is deployed');
    console.log('   3. Test by opening @' + me.username + ' in Telegram\n');
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Script ishga tushirish
setupBot();
