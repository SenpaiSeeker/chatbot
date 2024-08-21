const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { Readable } = require('stream');

const API_KEY = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID, 10);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const getText = (message) => {
    const replyText = message.reply_to_message ? 
        (message.reply_to_message.text || message.reply_to_message.caption || "") : 
        "";
    const userText = message.text || "";
    return `${userText}\n\n${replyText}`.trim() || replyText || userText;
};

const googleAI = async (question) => {
    if (!API_KEY) {
        return "Silakan periksa AI_GOOGLE_API Anda di file env";
    }

    const chatSession = model.startChat({
        generationConfig,
        history: [],
    });

    try {
        const result = await chatSession.sendMessage(question);
        return result.response.text();
    } catch (error) {
        return `Failed to generate content. Error: ${error.message}`;
    }
};

const mention = (user) => {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
};

const createStream = (content) => {
    const stream = new Readable();
    stream._read = () => {};
    stream.push(content);
    stream.push(null);
    return stream;
};

const sendLargeOutput = async (chatId, output, msgId) => {
    const outFile = createStream(output);
    await bot.sendDocument(chatId, outFile, {}, { filename: "result.txt" });
    await bot.deleteMessage(chatId, msgId);
};

const ownerNotif = (func) => async (message) => {
    if (message.from.id !== OWNER_ID) {
        const link = message.from.username ?
            `https://t.me/${message.from.username}` :
            `tg://openmessage?user_id=${message.from.id}`;
        const markup = {
            inline_keyboard: [[{ text: "link profil", url: link }]]
        };
        await bot.sendMessage(OWNER_ID, message.text, { reply_markup: markup });
    }
    return func(message);
};

bot.onText(/.*/, ownerNotif(async (message) => {
    if (message.text.startsWith("/start")) {
        const markup = {
            inline_keyboard: [
                [{ text: "Repository", url: "https://github.com/SenpaiSeeker/gemini-chatbot" }],
                [{ text: "developer", url: "https://t.me/NorSodikin" }]
            ]
        };
        await bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { reply_markup: markup, parse_mode: 'MarkdownV2' }
        );
    } else {
        const msg = await bot.sendMessage(message.chat.id, "Silahkan tunggu...");
        try {
            const result = await googleAI(getText(message));
            await bot.editMessageText("Processing...", { chat_id: message.chat.id, message_id: msg.message_id });
            const outputStream = createStream(result);
            await bot.sendDocument(message.chat.id, outputStream, {}, { filename: "result.txt" });
            await bot.deleteMessage(message.chat.id, msg.message_id);
        } catch (error) {
            await bot.editMessageText(error.toString(), { chat_id: message.chat.id, message_id: msg.message_id });
        }
    }
}));
