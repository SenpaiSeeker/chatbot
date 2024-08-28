const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

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
    logger.info('Memproses pertanyaan dari pengguna');
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
        logger.info('Berhasil mendapatkan respons dari Google AI');
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        logger.error(`Gagal mendapatkan respons dari Google AI: ${error.message}`);
        return `Failed to generate content. Status code: ${error.response ? error.response.status : 'unknown'}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const sendLargeOutput = async (chatId, output, msgId) => {
    logger.info('Mengirim output besar ke pengguna');
    if (output.length <= 4000) {
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } else {
        const filePath = path.join(__dirname, 'result.txt');
        fs.writeFileSync(filePath, output);

        await bot.sendDocument(chatId, filePath, {}, { filename: 'result.txt' });

        fs.unlinkSync(filePath);
    }
    bot.deleteMessage(chatId, msgId);
    logger.info('Pesan berhasil dikirim dan dihapus');
};

bot.on('message', async (message) => {
    logger.info(`Menerima pesan dari pengguna dengan ID: ${message.from.id}`);
    
    if (message.text.startsWith('/start')) {
        const markup = {
            inline_keyboard: [
                [{ text: 'developer', url: 'https://t.me/NorSodikin' }]
            ]
        };
        bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot berbasis program javascript. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: 'Markdown', reply_markup: JSON.stringify(markup) }
        );
        logger.info('Mengirim pesan selamat datang');
    } else {
        const msg = await bot.sendMessage(message.chat.id, 'Silahkan tunggu...');
        try {
            const result = await googleAI(getText(message));
            await sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            bot.editMessageText(`${error}`, message.chat.id, msg.message_id);
            logger.error(`Terjadi kesalahan: ${error.message}`);
        }
    }
});

logger.info('Bot is running...');
