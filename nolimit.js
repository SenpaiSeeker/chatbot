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

const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const getText = (message) => {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : (replyText + userText);
};

const NoLimitApi = async (question) => {
    logger.info('Memproses pertanyaan dari pengguna');

    const url = "https://nolimit-next-api.vercel.app/api/chatbot";
    const data = {
        text: question,
        lang: "indonesia",
        botid: "2231836083",
        botname: "@FakeCodeX"
    };
    const headers = { "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, data, { headers });
        logger.info('Berhasil mendapatkan respons dari API nolimit-next');

        const result = response.data;
        
        if (typeof result === 'object') {
            return JSON.stringify(result, null, 2);
        } else {
            return result;
        }
    } catch (error) {
        logger.error(`Gagal mendapatkan respons dari API nolimit-next: ${error.message}`);
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
        bot.sendMessage(chatId, output);
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
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot berbasis program javascript. Dan saya adalah robot kecerdasan buatan dari api nolimit-next, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: 'Markdown', reply_markup: JSON.stringify(markup) }
        );
        logger.info('Mengirim pesan selamat datang');
    } else {
        const msg = await bot.sendMessage(message.chat.id, 'Silahkan tunggu...');
        try {
            const result = await NoLimitApi(getText(message));
            await sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            bot.editMessageText(`${error}`, message.chat.id, msg.message_id);
            logger.error(`Terjadi kesalahan: ${error.message}`);
        }
    }
});

logger.info('Bot is running...');
