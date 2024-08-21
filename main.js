const { createBot, InputFile } = require('tgbot');
const axios = require('axios');
require('dotenv').config();

const bot = createBot(process.env.BOT_TOKEN);
const ownerId = parseInt(process.env.OWNER_ID, 10);

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;

const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

const getText = (message) => {
    const replyText = (message.reply_to_message && message.reply_to_message.text) 
        || (message.reply_to_message && message.reply_to_message.caption) 
        || '';
    const userText = message.text || '';
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
};

const googleAi = async (question) => {
    if (!AI_GOOGLE_API) {
        return "Silakan periksa AI_GOOGLE_API Anda di file .env";
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
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.status === 200) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            return `Failed to generate content. Status code: ${response.status}`;
        }
    } catch (error) {
        return `Failed to generate content. Status code: ${error.response ? error.response.status : 'unknown'}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const sendLargeOutput = async (message, output) => {
    if (output.length <= 4000) {
        await bot.api.sendMessage(message.chat.id, output, { parse_mode: 'MarkdownV2' });
    } else {
        const outFile = new InputFile(Buffer.from(output), 'result.txt');
        await bot.api.sendDocument(message.chat.id, outFile);
    }
};

const ownerNotif = (func) => async (message) => {
    if (message.from.id !== ownerId) {
        const link = message.from.username
            ? `https://t.me/${message.from.username}`
            : `tg://openmessage?user_id=${message.from.id}`;
        const markup = {
            inline_keyboard: [[{ text: 'Link Profil', url: link }]],
        };
        await bot.api.sendMessage(ownerId, escapeMarkdown(message.text), {
            reply_markup: markup,
            parse_mode: 'MarkdownV2',
        });
    }
    await func(message);
};

bot.on('message', ownerNotif(async (message) => {
    if (message.text.startsWith("/start")) {
        const markup = {
            inline_keyboard: [
                [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot' }],
                [{ text: 'Developer', url: 'https://t.me/NorSodikin' }]
            ],
        };

        await bot.api.sendMessage(
            message.chat.id,
            `**👋 Hai ${escapeMarkdown(mention(message.from))}!**\n\n` +
            `*Perkenalkan saya AI Google Telegram bot. Saya adalah robot kecerdasan buatan dari* [ai.google.dev](https://ai.google.dev), ` +
            `*dan saya siap menjawab pertanyaan yang Anda berikan.*`,
            { reply_markup: markup, parse_mode: 'MarkdownV2' }
        );
    } else {
        const msg = await bot.api.sendMessage(message.chat.id, "Silahkan tunggu...");
        try {
            const result = await googleAi(getText(message));
            await sendLargeOutput(message, escapeMarkdown(result));
            await bot.api.deleteMessage(message.chat.id, msg.message_id);
        } catch (error) {
            await bot.api.editMessageText(message.chat.id, msg.message_id, escapeMarkdown(error.message));
        }
    }
}));

bot.start();
