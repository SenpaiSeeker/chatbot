const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const markdownEscape = (text) => {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

const formatText = (text) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/__(.*?)__/g, '_$1_')
        .replace(/```(.*?)```/gs, '```$1```')
        .replace(/`(.*?)`/g, '`$1`')
        .replace(/~(.*?)~/g, '~$1~')
        .replace(/\|\|(.*?)\|\|/g, '||$1||');
};

bot.on('message', async (message) => {
    try {
        if (message.text.startsWith("/start")) {
            const markup = {
                inline_keyboard: [
                    [{ text: "Repository", url: "https://github.com/SenpaiSeeker/gemini-chatbot" }],
                    [{ text: "Developer", url: "https://t.me/NorSodikin" }]
                ]
            };
            const startMessage = `👋 Hai ${message.from.first_name}, Perkenalkan saya ai google telegram bot. Saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan.`;
            await bot.sendMessage(message.chat.id, markdownEscape(startMessage), { reply_markup: markup, parse_mode: 'MarkdownV2' });
        } else {
            const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
            const userText = message.text;
            const fullText = replyText ? `${userText}\n\n${replyText}` : userText;
            const formattedText = formatText(fullText);
            const msg = await bot.sendMessage(message.chat.id, "Silahkan tunggu...");

            const aiResponse = "Ini adalah respon dari Google AI";

            if (aiResponse.length <= 4000) {
                await bot.sendMessage(message.chat.id, markdownEscape(aiResponse), { parse_mode: 'MarkdownV2' });
            } else {
                await bot.sendDocument(message.chat.id, Buffer.from(aiResponse, 'utf-8'), { caption: 'Hasil terlalu panjang, disertakan dalam file.' });
            }
            await bot.deleteMessage(message.chat.id, msg.message_id);
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(message.chat.id, `Error: ${error.message}`);
    }
});

bot.on('polling_error', (error) => {
    console.log(error);
});
