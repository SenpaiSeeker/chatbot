const { Bot } = require('grammy');
const axios = require('axios');
require('dotenv').config();

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID, 10);

const bot = new Bot(BOT_TOKEN);

const getText = (message) => {
  const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : "";
  const userText = message.text || "";
  return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
};

const googleAi = async (question) => {
  if (!AI_GOOGLE_API) {
    return "Silakan periksa AI_GOOGLE_API Anda di file env";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AI_GOOGLE_API}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: question }] }],
    generationConfig: {
      temperature: 1,
      topK: 0,
      topP: 0.95,
      maxOutputTokens: 8192,
      stopSequences: [],
    },
  };

  try {
    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    return `Failed to generate content. Status code: ${error.response?.status || 'unknown'}`;
  }
};

const mention = (user) => {
  const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
  const link = `tg://user?id=${user.id}`;
  return `[${name}](${link})`;
};

const sendLargeOutput = async (chatId, output, msgId) => {
  if (output.length <= 4000) {
    await bot.api.sendMessage(chatId, output, { parse_mode: 'MarkdownV2' });
  } else {
    await bot.api.sendDocument(chatId, { source: Buffer.from(output), filename: 'result.txt' });
  }
  await bot.api.deleteMessage(chatId, msgId);
};

const ownerNotif = (handler) => {
  return async (ctx) => {
    const message = ctx.message;
    if (message.from.id !== OWNER_ID) {
      const link = message.from.username ? `https://t.me/${message.from.username}` : `tg://openmessage?user_id=${message.from.id}`;
      await bot.api.sendMessage(OWNER_ID, message.text, {
        reply_markup: {
          inline_keyboard: [[{ text: 'link profil', url: link }]]
        }
      });
    }
    return handler(ctx);
  };
};

bot.on('message', ownerNotif(async (ctx) => {
  const message = ctx.message;
  if (message.text.startsWith("/start")) {
    await bot.api.sendMessage(
      message.chat.id,
      `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot' }],
            [{ text: 'developer', url: 'https://t.me/NorSodikin' }]
          ]
        }
      }
    );
  } else {
    const msg = await bot.api.sendMessage(message.chat.id, "Silahkan tunggu...");
    try {
      const result = await googleAi(getText(message));
      await sendLargeOutput(message.chat.id, result, msg.message_id);
    } catch (error) {
      await bot.api.editMessageText(message.chat.id, msg.message_id, error.toString());
    }
  }
}));

bot.start();
