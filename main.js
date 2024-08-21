const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Markup } = require('telegraf');
const fetch = require('node-fetch');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID);
const AI_GOOGLE_API = process.env.AI_GOOGLE_API;

const client = new TelegramClient(new StringSession(''), BOT_TOKEN, { connectionRetries: 5 });

async function startBot() {
    await client.start({ botAuthToken: BOT_TOKEN });
    console.log('Bot started successfully');

    client.addEventHandler(async (event) => {
        const message = event.message;

        if (message.senderId !== OWNER_ID) {
            const userLink = message.sender.username
                ? `https://t.me/${message.sender.username}`
                : `tg://openmessage?user_id=${message.senderId}`;
            await client.sendMessage(OWNER_ID, {
                message: message.text,
                replyMarkup: Markup.inlineKeyboard([
                    Markup.button.url('Link Profil', userLink)
                ])
            });
        }

        if (message.text.startsWith('/start')) {
            await client.sendMessage(message.chatId, {
                message: `**👋 Hai [${message.sender.firstName}](tg://user?id=${message.senderId}) Perkenalkan saya ai google telegram bot. Dan saya adalah robot kecerdasan buatan dari ai.google.dev, dan saya siap menjawab pertanyaan yang Anda berikan**`,
                parseMode: 'Markdown',
                replyMarkup: Markup.inlineKeyboard([
                    Markup.button.url('Repository', 'https://github.com/SenpaiSeeker/gemini-chatbot'),
                    Markup.button.url('Developer', 'https://t.me/NorSodikin')
                ])
            });
        } else {
            const waitingMessage = await client.sendMessage(message.chatId, { message: 'Silahkan tunggu...' });
            try {
                const result = await googleAI(getText(message));
                await sendLargeOutput(client, message, result, waitingMessage);
            } catch (error) {
                await client.editMessage(message.chatId, { message: waitingMessage.id, text: String(error) });
            }
        }
    }, new Api.Updates());

    client.run();
}

async function googleAI(question) {
    if (!AI_GOOGLE_API) return 'Silakan periksa AI_GOOGLE_API Anda di file .env';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AI_GOOGLE_API}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: question }] }],
            generationConfig: {
                temperature: 1,
                topK: 0,
                topP: 0.95,
                maxOutputTokens: 8192,
                stopSequences: []
            }
        })
    });

    const data = await response.json();
    if (response.ok) return data.candidates[0].content.parts[0].text;
    return `Failed to generate content. Status code: ${response.status}`;
}

function getText(message) {
    const replyText = message.replyToMessage ? message.replyToMessage.text || message.replyToMessage.caption : '';
    const userText = message.text;
    return replyText && userText ? `${userText}\n\n${replyText}` : replyText + userText;
}

async function sendLargeOutput(client, message, output, waitingMessage) {
    if (output.length <= 4000) {
        await client.sendMessage(message.chatId, { message: output });
    } else {
        const file = Buffer.from(output, 'utf-8');
        await client.sendFile(message.chatId, { file, fileName: 'result.txt' });
    }
    await client.deleteMessage(message.chatId, { id: waitingMessage.id });
}

startBot();
