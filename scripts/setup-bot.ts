#!/usr/bin/env npx ts-node

/**
 * ScoreX Bot Setup & Webhook Management Script
 *
 * Usage:
 *   npx ts-node scripts/setup-bot.ts                    → Bot setup (menu, commands)
 *   npx ts-node scripts/setup-bot.ts webhook:set <url>  → Webhook o'rnatish
 *   npx ts-node scripts/setup-bot.ts webhook:delete      → Webhook o'chirish
 *   npx ts-node scripts/setup-bot.ts webhook:info        → Webhook holati
 *
 * Examples:
 *   npx ts-node scripts/setup-bot.ts webhook:set https://abc123.ngrok-free.app/telegram/webhook
 *   npx ts-node scripts/setup-bot.ts webhook:delete
 */

import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL =
  process.env.WEBAPP_URL || 'https://v0-score-x-trading-ui.vercel.app/';

function validateToken(): string {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
    process.exit(1);
  }
  return BOT_TOKEN;
}

// ══════════════════════════════════════════════
//  Bot Setup — menu button + commands
// ══════════════════════════════════════════════
async function setupBot() {
  const token = validateToken();
  const bot = new TelegramBot(token, { polling: false });

  console.log('🤖 ScoreX Bot Setup\n');
  console.log(`📱 WebApp URL: ${WEBAPP_URL}\n`);

  try {
    const me = await bot.getMe();
    console.log(`✅ Connected: @${me.username} (${me.first_name})`);

    // Menu button
    console.log('\n📋 Setting up menu button...');
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '📱 Open ScoreX',
        web_app: { url: WEBAPP_URL },
      },
    });
    console.log('✅ Menu button configured');

    // Commands
    console.log('\n📋 Setting up commands...');
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot / Open app' },
      { command: 'help', description: 'Show help message' },
      { command: 'webapp', description: 'Open WebApp' },
    ]);
    console.log('✅ Commands configured');

    // Webhook info
    const info = await bot.getWebHookInfo();
    console.log('\n📊 Current Webhook:');
    console.log(`   URL: ${info.url || '❌ Not set'}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);
    if (info.last_error_message) {
      console.log(`   ⚠️  Last error: ${info.last_error_message}`);
    }

    console.log('\n✅ Bot setup complete!\n');
  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════
//  Webhook Set
// ══════════════════════════════════════════════
async function webhookSet(url: string) {
  const token = validateToken();
  const bot = new TelegramBot(token, { polling: false });

  console.log(`🔗 Setting webhook to: ${url}\n`);

  try {
    await bot.setWebHook(url);
    const info = await bot.getWebHookInfo();

    console.log('✅ Webhook set successfully!');
    console.log(`   URL: ${info.url}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);

    if (info.last_error_message) {
      console.log(`   ⚠️  Last error: ${info.last_error_message}`);
    } else {
      console.log('   ✅ No errors');
    }
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════
//  Webhook Delete
// ══════════════════════════════════════════════
async function webhookDelete() {
  const token = validateToken();
  const bot = new TelegramBot(token, { polling: false });

  console.log('🗑️  Deleting webhook...\n');

  try {
    await bot.deleteWebHook();
    const info = await bot.getWebHookInfo();

    console.log('✅ Webhook deleted!');
    console.log(`   URL: ${info.url || '(empty)'}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════
//  Webhook Info
// ══════════════════════════════════════════════
async function webhookInfo() {
  const token = validateToken();
  const bot = new TelegramBot(token, { polling: false });

  console.log('📊 Webhook Info\n');

  try {
    const info = await bot.getWebHookInfo();

    console.log(`   URL:              ${info.url || '❌ Not set'}`);
    console.log(`   Pending updates:  ${info.pending_update_count}`);
    console.log(`   Max connections:  ${info.max_connections || 'default'}`);
    console.log(
      `   Custom cert:     ${info.has_custom_certificate ? 'Yes' : 'No'}`,
    );

    if (info.last_error_date) {
      const errorDate = new Date(info.last_error_date * 1000);
      console.log(`   Last error date:  ${errorDate.toISOString()}`);
      console.log(`   Last error:       ${info.last_error_message}`);
    } else {
      console.log('   ✅ No errors');
    }
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════
//  CLI Router
// ══════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  switch (command) {
    case 'setup':
      await setupBot();
      break;

    case 'webhook:set': {
      const url = args[1];
      if (!url) {
        console.error('❌ URL kerak!');
        console.log(
          '   Usage: npx ts-node scripts/setup-bot.ts webhook:set <url>',
        );
        console.log(
          '   Example: npx ts-node scripts/setup-bot.ts webhook:set https://abc123.ngrok-free.app/telegram/webhook',
        );
        process.exit(1);
      }
      await webhookSet(url);
      break;
    }

    case 'webhook:delete':
    case 'webhook:remove':
      await webhookDelete();
      break;

    case 'webhook:info':
    case 'webhook:status':
      await webhookInfo();
      break;

    default:
      console.log('🤖 ScoreX Bot CLI\n');
      console.log('Commands:');
      console.log('  (no args)         Bot setup (menu button, commands)');
      console.log('  webhook:set <url> Set webhook URL');
      console.log('  webhook:delete    Delete webhook');
      console.log('  webhook:info      Show webhook status');
      console.log('\nExamples:');
      console.log('  npx ts-node scripts/setup-bot.ts');
      console.log(
        '  npx ts-node scripts/setup-bot.ts webhook:set https://abc123.ngrok-free.app/telegram/webhook',
      );
      console.log('  npx ts-node scripts/setup-bot.ts webhook:delete');
      break;
  }
}

main();
