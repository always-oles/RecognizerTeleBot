// private data
const config = require('./config');
const helpers = require('./helpers');
// google vision API, initializing with CONFIG
const vision = require('@google-cloud/vision')(config);
// google translate api
const translateClient = require('@google-cloud/translate')(config);
// The target language
const targetLanguage = 'ru';
// for easy REST queries
const REST = require('restler');
const TelegramBot = require('node-telegram-bot-api');
const apiURL = 'https://api.telegram.org/';
const botURL = apiURL + 'bot' + config.token + '/'
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(config.token, {polling: true});

// default start message, fires when user clicks on START button right after
// adding a bot to contacts or manually by typing /start
bot.onText(/\/start/, (msg, match) => {
  bot.sendMessage(msg.chat.id, `Hello there, my name is Rick! Send me a photo and I'll tell you what I see on it. 😎`);
  return;
});

// basic help message
bot.onText(/help/gi, (msg, match) => {
  bot.sendMessage(msg.chat.id,
    `My name is Rick, I'm a bot that uses Google vision API to recognize image labels.
If you 😍<b>like me</b>😍 - leave a star here: <a href="https://github.com/always-oles/TelegramRecognizerBot">Github page</a>`,
    {parse_mode: 'HTML'}
  );
});

// debugging any incoming message
bot.on('message', (msg) => {
  console.log(msg);
});

// send one of 4 favorite stickers in return to sticker
bot.on('sticker', (msg) => {
  bot.sendSticker(msg.chat.id, [
      'CAADAgADhQYAAiMhBQABqCwuoKvunScC',
      'CAADAgAD-hgAAkKvaQABIW2zLLdmAAGjAg',
      'CAADAgADBhkAAkKvaQABQCW1myZ3LwoC',
      'CAADAgADfQYAAiMhBQAB1Kj785im7mAC'
    ][Math.floor(Math.random()*4)]); // Don't ask me why/how
});

// Listen for any kind of message
bot.on('photo', (msg) => {
  const chatId = msg.chat.id;

  // ask nicely to wait
  bot.sendMessage(chatId, '<pre>Just a moment...</pre>', {parse_mode : 'HTML'});

  // get the best quality photo (last one in array)
  const file = msg.photo[msg.photo.length-1];

  // make URL for request
  const file_url = botURL + 'getFile?file_id=' + file.file_id;

  // make a GET request to Telegram servers, asking for a file path by file ID
  REST.get(file_url).on('complete', (response) => {
    if (response.result) {
      // final URL of the best quality image sent by user
      const fullsize_url = apiURL + 'file/bot' + config.token + '/' + response.result.file_path;

      // detect labels by vision API
      vision.labelDetection({ source: { imageUri: fullsize_url } })
        .then((results) => {
          const labels = results[0].labelAnnotations;

          let descriptions = [], scores = [], raw = ``;

          // create an array of labels and scores to make them look good later
          // also concatenate all descriotions into one array with commas
          labels.forEach((label) => {
            descriptions.push(label.description);
            scores.push(label.score);
            raw += label.description + ',';
          });

          // translate labels
          translateClient.translate(raw, targetLanguage)
            .then((response) => {
              const finalMessage = '<b>I\'m ready, here is what I see:</b>\n' +
              helpers.makeLookGood(descriptions, scores, response[0]) + '\n';

              bot.sendMessage(chatId, finalMessage, {parse_mode : "HTML"});
            })
            .catch((err) => {
              console.error('ERROR:', err);
              bot.sendMessage(chatId, 'Oops, something went wrong...');
            });
        })
        .catch((error) => {
          console.error('ERROR:', error);
          bot.sendMessage(chatId, 'Oops, something went wrong...');
        });
    }
  });
});
