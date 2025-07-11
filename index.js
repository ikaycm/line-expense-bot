const express = require('express');
const { Client } = require('@line/bot-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('LINE Income/Expense Bot is running!');
});

app.post('/webhook', (req, res) => {
  const events = req.body.events;
  if (!events) {
    return res.sendStatus(400);
  }

  Promise.all(events.map(event => {
    if (event.type === 'message' && event.message.type === 'text') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณส่งข้อความว่า: ${event.message.text}`
      });
    }
    return Promise.resolve(null);
  }))
  .then(() => res.sendStatus(200))
  .catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
