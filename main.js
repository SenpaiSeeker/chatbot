const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const translate = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const getText = (message) => {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : (replyText + userText);
};

const googleAI = async (question) => {
    if (!AI_GOOGLE_API) return "Silakan periksa AI_GOOGLE_API Anda di file env";
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
        return `Failed to generate content. Status code: ${error.response ? error.response.status : 'unknown'}`;
    }
};

const translateToIndonesian = async (text) => {
    try {
        const res = await translate(text, { to: 'id' });
        return res.text;
    } catch (error) {
        return `Translation error: ${error.message}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const sendLargeOutput = async (chatId, output, msgId) => {
    if (output.length <= 4000) {
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } else {
        const filePath = path.join(__dirname, 'result.txt');
        fs.writeFileSync(filePath, output);

        await bot.sendDocument(chatId, filePath, {}, { filename: 'result.txt' });

        fs.unlinkSync(filePath);
    }
    bot.deleteMessage(chatId, msgId);
};

const ownerNotif = (message) => {
    if (message.from.id !== OWNER_ID) {
        const link = message.from.username ? `https://t.me/${message.from.username}` : `tg://openmessage?user_id=${message.from.id}`;
        const markup = {
            inline_keyboard: [[{ text: 'link profil', url: link }]]
        };
        bot.sendMessage(OWNER_ID, message.text, { reply_markup: JSON.stringify(markup) });
    }
};

bot.on('message', async (message) => {
    ownerNotif(message);

    if (message.text.startsWith('/start')) {
        const markup = {
            inline_keyboard: [
                [{ text: 'Repository', url: 'https://github.com/DreamBoxs/ai-telegram-bot' }],
                [{ text: 'Credit', url: 'https://t.me/NorSodikin' }]
            ]
        };
        bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: 'Markdown', reply_markup: JSON.stringify(markup) }
        );
    } else {
        const msg = await bot.sendMessage(message.chat.id, 'Silahkan tunggu...');
        try {
            const result = await googleAI(getText(message));
            const translatedResult = await translateToIndonesian(result);
            await sendLargeOutput(message.chat.id, translatedResult, msg.message_id);
        } catch (error) {
            bot.editMessageText(`${error}`, message.chat.id, msg.message_id);
        }
    }
});
