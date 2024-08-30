import os
import logging
import requests
import json
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Updater, CommandHandler, MessageHandler, CallbackContext, filters
from telegram.ext.dispatcher import run_async

logging.basicConfig(
    format='%(asctime)s [%(levelname)s]: %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv('BOT_TOKEN')

def get_text(message):
    reply_text = message.reply_to_message.text if message.reply_to_message else ''
    user_text = message.text
    return f"{user_text}\n\n{reply_text}" if reply_text and user_text else reply_text + user_text

@run_async
def no_limit_api(question):
    logger.info('Memproses pertanyaan dari pengguna')
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
        logger.info('Berhasil mendapatkan respons dari API nolimit-next')
        result = response.json().get('message')
        return json.dumps(result, indent=2) if isinstance(result, dict) else result
    except requests.RequestException as error:
        logger.error(f'Gagal mendapatkan respons dari API nolimit-next: {error}')
        return f"Failed to generate content. Status code: {error.response.status_code if error.response else 'unknown'}"

def mention(user):
    name = f"{user.first_name} {user.last_name}" if user.last_name else user.first_name
    return f"[{name}](tg://user?id={user.id})"

def send_large_output(update: Update, context: CallbackContext, output):
    logger.info('Mengirim output besar ke pengguna')
    if len(output) <= 4000:
        update.message.reply_text(output, parse_mode='Markdown')
    else:
        file_path = 'result.txt'
        with open(file_path, 'w') as file:
            file.write(output)
        update.message.reply_document(open(file_path, 'rb'))
        os.remove(file_path)

def start(update: Update, context: CallbackContext):
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton(text='developer', url='https://t.me/NorSodikin')]
    ])
    update.message.reply_text(
        f"**👋 Hai {mention(update.message.from_user)} Perkenalkan saya ai telegram bot berbasis program Python. Dan saya adalah robot kecerdasan buatan dari API nolimit-next, dan saya siap menjawab pertanyaan yang Anda berikan**",
        parse_mode='Markdown', reply_markup=markup
    )
    logger.info('Mengirim pesan selamat datang')

def handle_message(update: Update, context: CallbackContext):
    logger.info(f'Menerima pesan dari pengguna dengan ID: {update.message.from_user.id}')
    context.bot.send_chat_action(chat_id=update.message.chat_id, action='typing')
    result = no_limit_api(get_text(update.message))
    send_large_output(update, context, result)

def main():
    updater = Updater(token=BOT_TOKEN, use_context=True)
    dispatcher = updater.dispatcher

    dispatcher.add_handler(CommandHandler('start', start))
    dispatcher.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    updater.start_polling()
    logger.info('Bot is running...')
    updater.idle()

if __name__ == '__main__':
    main()
