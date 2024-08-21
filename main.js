const axios = require('axios');
const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
dotenv.config();

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const getText = (message) => {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : "";
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : (replyText + userText);
};

const googleAI = async (question) => {
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
        const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
        if (response.status === 200) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            return `Failed to generate content. Status code: ${response.status}`;
        }
    } catch (error) {
        return `Request failed: ${error.message}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const sanitizeMarkdownV2 = (text) => {
    return text
        .replace(/([*_~`\[\]()>#+\-.!|])/g, '\\$1')
        .replace(/`/g, '\\`')
        .replace(/([^\x00-\x7F])/g, '\\u$1');
};

const sendLargeOutput = (chatId, output, msgId) => {
    const sanitizedOutput = sanitizeMarkdownV2(output);
    if (sanitizedOutput.length <= 4000) {
        bot.sendMessage(chatId, sanitizedOutput, { parse_mode: "MarkdownV2" });
    } else {
        const outFile = Buffer.from(sanitizedOutput, 'utf-8');
        bot.sendDocument(chatId, outFile, {}, { filename: "result.txt" });
    }
    bot.deleteMessage(chatId, msgId);
};

const ownerNotif = (func) => {
    return (message) => {
        if (message.from.id !== OWNER_ID) {
            const link = message.from.username
                ? `https://t.me/${message.from.username}`
                : `tg://openmessage?user_id=${message.from.id}`;
            const markup = {
                inline_keyboard: [[{ text: "link profil", url: link }]],
            };
            bot.sendMessage(OWNER_ID, message.text, { reply_markup: markup });
        }
        func(message);
    };
};

bot.on('message', ownerNotif(async (message) => {
    if (message.text.startsWith("/start")) {
        const markup = {
            inline_keyboard: [
                [{ text: "Repository", url: "https://github.com/SenpaiSeeker/gemini-chatbot" }],
                [{ text: "developer", url: "https://t.me/NorSodikin" }],
            ],
        };
        bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: "Markdown", reply_markup: markup }
        );
    } else {
        const msg = await bot.sendMessage(message.chat.id, "Silahkan tunggu...");
        try {
            const result = await googleAI(getText(message));
            sendLargeOutput(message.chat.id, result, msg.message_id);
        } catch (error) {
            bot.editMessageText(error.message, { chat_id: message.chat.id, message_id: msg.message_id });
        }
    }
}));
