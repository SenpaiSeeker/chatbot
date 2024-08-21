require('dotenv').config();
const axios = require('axios');
const { Telegraf } = require('telegraf');
const fs = require('fs');

const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new Telegraf(BOT_TOKEN);

const textTemplate = `
user_id: {}
name: {}

msg: {}
`;

function getText(ctx) {
    const replyText = ctx.message.reply_to_message
        ? ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption
        : '';
    const userText = ctx.message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
}

async function googleAi(question) {
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
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `Failed to generate content. Status code: ${error.response.status}`;
    }
}

function mention(user) {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    return `[${name}](tg://user?id=${user.id})`;
}

function sendLargeOutput(ctx, output) {
    if (output.length <= 4000) {
        ctx.reply(output);
    } else {
        fs.writeFileSync('result.txt', output);
        ctx.replyWithDocument({ source: 'result.txt' });
    }
}

function ownerNotif(ctx, next) {
    if (ctx.from.id !== OWNER_ID) {
        const link = ctx.from.username
            ? `https://t.me/${ctx.from.username}`
            : `tg://openmessage?user_id=${ctx.from.id}`;
        ctx.telegram.sendMessage(OWNER_ID, ctx.message.text, {
            reply_markup: {
                inline_keyboard: [[{ text: 'link profil', url: link }]]
            }
        });
    }
    return next();
}

bot.use(ownerNotif);

bot.start((ctx) => {
    ctx.replyWithMarkdown(
        `**👋 Hai ${mention(ctx.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot' }],
                    [{ text: 'developer', url: 'https://t.me/NorSodikin' }],
                ],
            },
        }
    );
});

bot.on('text', async (ctx) => {
    const msg = await ctx.reply('Silahkan tunggu...');
    try {
        const result = await googleAi(getText(ctx));
        sendLargeOutput(ctx, result);
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, String(error));
    }
});

bot.launch();
