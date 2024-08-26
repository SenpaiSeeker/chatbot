const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const aiGoogleApi = process.env.AI_GOOGLE_API;
const ownerId = parseInt(process.env.OWNER_ID, 10);

const bot = new TelegramBot(token, { polling: true });

const getText = (message) => {
    const replyText = (message.reply_to_message && (message.reply_to_message.text || message.reply_to_message.caption)) || '';
    const userText = message.text || '';
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
};

const googleAi = async (question) => {
    if (!aiGoogleApi) {
        return 'Silakan periksa AI_GOOGLE_API Anda di file env';
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${aiGoogleApi}`;
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
        const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `Failed to generate content. Status code: ${error.response ? error.response.status : 'unknown'}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const sendLargeOutput = async (chatId, output, msgId) => {
    if (output.length <= 4000) {
        await bot.sendMessage(chatId, output, { parse_mode: 'HTML' });
    } else {
        await bot.sendDocument(chatId, Buffer.from(output, 'utf-8'), { filename: 'result.txt' });
    }
    await bot.deleteMessage(chatId, msgId);
};

const ownerNotif = (func) => {
    return async (message) => {
        if (message.from.id !== ownerId) {
            const link = message.from.username 
                ? `https://t.me/${message.from.username}`
                : `tg://openmessage?user_id=${message.from.id}`;
            const markup = {
                inline_keyboard: [[
                    { text: 'Link Profil', url: link }
                ]]
            };
            await bot.sendMessage(ownerId, message.text, { reply_markup: JSON.stringify(markup) });
        }
        return func(message);
    };
};

bot.on('message', ownerNotif(async (message) => {
    if (message.text.startsWith('/start')) {
        const markup = {
            inline_keyboard: [
                [{ text: 'Repository', url: 'https://github.com/DreamBoxs/ai-telegram-bot' }],
                [{ text: 'Credit', url: 'https://t.me/NorSodikin' }]
            ]
        };
        await bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: 'Markdown', reply_markup: JSON.stringify(markup) }
        );
    } else {
        const msg = await bot.replyTo(message, 'Silahkan tunggu...');
        try {
            const result = await googleAi(getText(message));
            await sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            await bot.editMessageText(error.message, { chat_id: message.chat.id, message_id: msg.message_id });
        }
    }
}));
