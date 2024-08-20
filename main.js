const axios = require('axios');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const AI_GOOGLE_API = process.env.AI_GOOGLE_API;
const OWNER_ID = parseInt(process.env.OWNER_ID);

const bot = new Telegraf(BOT_TOKEN);

const textTemplate = `
user_id: {}
name: {}

msg: {}
`;

function getText(ctx) {
    const replyText = ctx.message.reply_to_message ? (ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption) : '';
    const userText = ctx.message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : `${replyText}${userText}`;
}

async function googleAI(question) {
    if (!AI_GOOGLE_API) {
        return "Silakan periksa AI_GOOGLE_API Anda di file env";
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${AI_GOOGLE_API}`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: {
            temperature: 1,
            topK: 0,
            topP: 0.95,
            maxOutputTokens: 8192,
            stopSequences: []
        }
    };
    try {
        const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `Failed to generate content. Status code: ${error.response.status}`;
    }
}

function mention(user) {
    const name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
    const link = `tg://user?id=${user.id}`;
    return `[${name}](${link})`;
}

async function sendLargeOutput(ctx, output, msg) {
    if (output.length <= 4000) {
        await ctx.reply(output);
    } else {
        await ctx.replyWithDocument({ source: Buffer.from(output), filename: 'result.txt' });
    }
    await bot.telegram.deleteMessage(ctx.chat.id, msg.message_id);
}

function ownerNotif(func) {
    return async (ctx) => {
        if (ctx.from.id !== OWNER_ID) {
            const link = ctx.from.username ? `https://t.me/${ctx.from.username}` : `tg://openmessage?user_id=${ctx.from.id}`;
            const markup = {
                reply_markup: {
                    inline_keyboard: [[{ text: 'link profil', url: link }]]
                }
            };
            await ctx.telegram.sendMessage(OWNER_ID, ctx.message.text, markup);
        }
        return func(ctx);
    };
}

bot.on('message', ownerNotif(async (ctx) => {
    if (ctx.message.text.startsWith('/start')) {
        const markup = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Repository', url: 'https://github.com/SenpaiSeeker/gemini-chatbot'}],
                    [{ text: 'developer', url: 'https://t.me/NorSodikin' }]
                ]
            }
        };
        await ctx.replyWithMarkdown(
            `**👋 Hai ${mention(ctx.from)} Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
            markup
        );
    } else {
        const msg = await ctx.reply('Silahkan tunggu...');
        try {
            const result = await googleAI(getText(ctx));
            await sendLargeOutput(ctx, result, msg);
        } catch (error) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, String(error));
        }
    }
}));

bot.launch();
