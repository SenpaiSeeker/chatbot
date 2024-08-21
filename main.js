const { Client, Message } = require('pyrogram');
const axios = require('axios');
require('dotenv').config();

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new Client('my_bot', {
  apiId: API_ID,
  apiHash: API_HASH,
  botToken: BOT_TOKEN
});

const textTemplate = `
user_id: {userId}
name: {name}

msg: {msg}
`;

const getText = (message) => {
  const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
  const userText = message.text;
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

const sendLargeOutput = async (chatId, output, msgId) => {
  if (output.length <= 4000) {
    await bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
  } else {
    await bot.sendDocument(chatId, { source: Buffer.from(output), filename: 'result.txt' });
  }
  await bot.deleteMessage(chatId, msgId);
};

const ownerNotif = (func) => {
  return async (message) => {
    if (message.from.id !== OWNER_ID) {
      const link = message.from.username
        ? `https://t.me/${message.from.username}`
        : `tg://openmessage?user_id=${message.from.id}`;

      const markup = {
        inline_keyboard: [[{ text: 'Link profil', url: link }]]
      };

      await bot.sendMessage(OWNER_ID, message.text, { reply_markup: markup });
    }
    await func(message);
  };
};

bot.on('message', ownerNotif(async (message) => {
  if (message.text.startsWith('/start')) {
    const markup = {
      inline_keyboard: [
        [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot' }],
        [{ text: 'Developer', url: 'https://t.me/NorSodikin' }],
      ],
    };

    await bot.sendMessage(
      message.chat.id,
      `**👋 Hai ${mention(message.from)} Perkenalkan saya AI Google Telegram bot. Saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
      { reply_markup: markup, parse_mode: 'Markdown' }
    );
  } else {
    const msg = await bot.sendMessage(message.chat.id, 'Silahkan tunggu...');
    try {
      const result = await googleAI(getText(message));
      await sendLargeOutput(message.chat.id, result, msg.message_id);
    } catch (error) {
      await bot.editMessageText(error.message, { chat_id: message.chat.id, message_id: msg.message_id });
    }
  }
}));

bot.start();
