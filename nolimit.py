import logging
import os
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def logs(msg):
    return logging.getLogger(msg)

BOT_TOKEN = os.getenv('BOT_TOKEN')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    keyboard = [[InlineKeyboardButton("developer", url="https://t.me/NorSodikin")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"👋 Hai [{user.first_name}](tg://user?id={user.id})! "
        "Perkenalkan saya ai telegram bot berbasis program python. "
        "Dan saya adalah robot kecerdasan buatan dari api nolimit-next, "
        "dan saya siap menjawab pertanyaan yang Anda berikan.",
        parse_mode='Markdown',
        reply_markup=reply_markup
    )
    logs(__name__).info('Mengirim pesan selamat datang')

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {update.effective_user.id}")
    
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action='typing')
    
    try:
        result = await no_limit_api(user_message)
        await send_large_output(update, result, context)
    except Exception as e:
        await update.message.reply_text(f"Terjadi kesalahan: {str(e)}")
        logs(__name__).error(f"Terjadi kesalahan: {str(e)}")

async def no_limit_api(question):
    logs(__name__).info('Memproses pertanyaan dari pengguna')
    
    url = "https://nolimit-next-api.vercel.app/api/chatbot"
    data = {
        "text": question,
        "lang": "indonesia",
        "botid": "2231836083",
        "botname": "@FakeCodeX"
    }
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        logs(__name__).info('Berhasil mendapatkan respons dari API nolimit-next')
        
        result = response.json().get('message', '')
        return result if isinstance(result, str) else str(result)
    except requests.RequestException as e:
        logs(__name__).error(f"Gagal mendapatkan respons dari API nolimit-next: {e}")
        return f"Failed to generate content. Error: {str(e)}"

async def send_large_output(update, output, context):
    logs(__name__).info('Mengirim output besar ke pengguna')
    if len(output) <= 4000:
        await update.message.reply_text(output, parse_mode='Markdown')
    else:
        with open('result.txt', 'w') as file:
            file.write(output)
        
        await context.bot.send_document(chat_id=update.effective_chat.id, document=open('result.txt', 'rb'))
        os.remove('result.txt')

def main():
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    application.run_polling()

if __name__ == '__main__':
    main()
