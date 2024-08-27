const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const gpt4free = require('gpt4free');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const getText = (message) => {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : (replyText + userText);
};

const gptAi = async (question) => {
    try {
        const response = await gpt4free.getCompletion(question, { language: 'id' });
        return response;
    } catch (error) {
        return `Gagal menghasilkan konten. Kode status: ${error.response ? error.response.status : 'tidak diketahui'}`;
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
            let result = await gptAi(getText(message));
            await sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            bot.editMessageText(`${error}`, message.chat.id, msg.message_id);
        }
    }
});
