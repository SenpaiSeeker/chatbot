const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const MarkdownIt = require('markdown-it');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);
const AI_GOOGLE_API = process.env.AI_GOOGLE_API;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const md = new MarkdownIt();

function getText(message) {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption || '') : '';
    const userText = message.text || '';
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
}

async function googleAI(question) {
    if (!AI_GOOGLE_API) {
        return "Silakan periksa AI_GOOGLE_API Anda di file env";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AI_GOOGLE_API}`;
    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: question
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 1,
            topK: 64,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain"
        }
    };

    try {
        const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `Failed to generate content. Status code: ${error.response ? error.response.status : 'unknown'}`;
    }
}

function mention(user) {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
}

async function sendLargeOutput(chatId, output, msgId) {
    if (output.length <= 4000) {
        await bot.sendMessage(chatId, output, { parse_mode: 'HTML' });
    } else {
        await bot.sendDocument(chatId, { source: Buffer.from(output), filename: 'result.txt' });
    }
    await bot.deleteMessage(chatId, msgId);
}

function ownerNotif(handler) {
    return async (message) => {
        if (message.from.id !== OWNER_ID) {
            const link = message.from.username
                ? `https://t.me/${message.from.username}`
                : `tg://openmessage?user_id=${message.from.id}`;
            const markup = {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Link Profil', url: link }]],
                },
            };
            await bot.sendMessage(OWNER_ID, message.text, markup);
        }
        await handler(message);
    };
}

bot.on('message', ownerNotif(async (message) => {
    if (message.text.startsWith('/start')) {
        const markup = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot' }],
                    [{ text: 'Developer', url: 'https://t.me/NorSodikin' }],
                ],
            },
        };
        await bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: 'HTML', ...markup }
        );
    } else {
        const msg = await bot.sendMessage(message.chat.id, "Silahkan tunggu...");
        try {
            let result = await googleAI(getText(message));
            result = md.render(result);
            await sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            await bot.editMessageText(`Error: ${error.message}`, { chat_id: message.chat.id, message_id: msg.message_id });
        }
    }
}));

process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});
