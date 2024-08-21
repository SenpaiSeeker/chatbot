const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');
require('dotenv').config();

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new Bot(BOT_TOKEN);

const getText = (ctx) => {
  const replyText = ctx.message.reply_to_message
    ? (ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption)
    : '';
  const userText = ctx.message.text;
  return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
};

const googleAI = async (question) => {
  if (!AI_GOOGLE_API) {
    return 'Silakan periksa AI_GOOGLE_API Anda di file env';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AI_GOOGLE_API}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: {
      temperature: 1,
      topK: 0,
      topP: 0.95,
      maxOutputTokens: 8192,
      stopSequences: [],
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 200) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      return `Failed to generate content. Status code: ${response.status}`;
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
};

const mention = (user) => {
  const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
  const link = `tg://user?id=${user.id}`;
  return `[${name}](${link})`;
};

const sendLargeOutput = async (ctx, output, msg) => {
  if (output.length <= 4000) {
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, output, { parse_mode: 'Markdown' });
  } else {
    await ctx.replyWithDocument(
      { source: Buffer.from(output), filename: 'result.txt' },
      { reply_to_message_id: msg.message_id }
    );
  }
  await ctx.api.deleteMessage(ctx.chat.id, msg.message_id);
};

const ownerNotif = (next) => async (ctx) => {
  if (ctx.from.id !== OWNER_ID) {
    const link = ctx.from.username
      ? `https://t.me/${ctx.from.username}`
      : `tg://openmessage?user_id=${ctx.from.id}`;

    const keyboard = new InlineKeyboard().url('Link profil', link);

    await bot.api.sendMessage(OWNER_ID, ctx.message.text, { reply_markup: keyboard });
  }
  await next(ctx);
};

bot.use(ownerNotif);

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .url('Repository', 'https://github.com/SenpaiSeeker/gemini-chatbot')
    .url('Developer', 'https://t.me/NorSodikin');

  await ctx.reply(
    `**👋 Hai ${mention(ctx.from)} Perkenalkan saya AI Google Telegram bot. Saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
    { reply_markup: keyboard, parse_mode: 'Markdown' }
  );
});

bot.on('message', async (ctx) => {
  const msg = await ctx.reply('Silahkan tunggu...');
  try {
    const result = await googleAI(getText(ctx));
    await sendLargeOutput(ctx, result, msg);
  } catch (error) {
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, error.message);
  }
});

bot.start();
