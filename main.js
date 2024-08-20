const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const process = require('process');
const path = require('path');

dotenv.config({ path: process.argv[2] || path.resolve(__dirname, '.env') });

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID, 10);

if (!BOT_TOKEN) {
    console.error("Error: Telegram Bot Token not provided!");
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("Bot started...");
console.log("Listening for messages...");

const text = `
user_id: {}
name: {}

msg: {}
`;

function getText(message) {
    const replyText = message.reply_to_message ? (message.reply_to_message.text || message.reply_to_message.caption) : '';
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
}

async function googleAI(question) {
    if (!AI_GOOGLE_API) {
        return "Silakan periksa AI_GOOGLE_API Anda di file env";
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${AI_GOOGLE_API}`;
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
    const headers = { "Content-Type": "application/json" };
    try {
        const response = await axios.post(url, payload, { headers });
        if (response.status === 200) {
            console.log("AI response received successfully");
            return response.data.candidates[0].content.parts[0].text;
        } else {
            console.error(`Failed to generate content. Status code: ${response.status}`);
            return `Failed to generate content. Status code: ${response.status}`;
        }
    } catch (error) {
        console.error(`Failed to generate content. Error: ${error.message}`);
        return `Failed to generate content. Error: ${error.message}`;
    }
}

function mention(user) {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
}

function sendLargeOutput(message, output, msg) {
    if (output.length <= 4000) {
        bot.sendMessage(message.chat.id, output);
    } else {
        const resultFile = Buffer.from(output, 'utf-8');
        bot.sendDocument(message.chat.id, resultFile, {}, { filename: 'result.txt' });
    }
    bot.deleteMessage(message.chat.id, msg.message_id);
    console.log("Output sent to user.");
}

function ownerNotif(func) {
    return function(message) {
        if (message.from.id !== OWNER_ID) {
            const link = message.from.username ? `https://t.me/${message.from.username}` : `tg://openmessage?user_id=${message.from.id}`;
            const markup = {
                inline_keyboard: [[{ text: "link profil", url: link }]]
            };
            bot.sendMessage(OWNER_ID, message.text, { reply_markup: markup });
            console.log(`Notification sent to owner for message from ${message.from.id}`);
        }
        return func(message);
    };
}

bot.on('message', ownerNotif(async (message) => {
    if (message.text.startsWith('/start')) {
        const markup = {
            inline_keyboard: [
                [{ text: "Repository", url: "https://github.com/V1HyperBot/chatbot" }],
                [{ text: "Credit", url: "https://t.me/NorSodikin" }],
            ],
        };
        bot.sendMessage(
            message.chat.id,
            `**👋 Hai ${mention(message.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            { parse_mode: "Markdown", reply_markup: markup }
        );
        console.log("Sent /start message to user.");
    } else {
        const msg = await bot.sendMessage(message.chat.id, "Silahkan tunggu...");
        try {
            const result = await googleAI(getText(message));
            sendLargeOutput(message, result, msg);
        } catch (error) {
            bot.editMessageText(error.message, { chat_id: message.chat.id, message_id: msg.message_id });
            console.error(`Error while handling message: ${error.message}`);
        }
    }
}));
