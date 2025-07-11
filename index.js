const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.get('/', (req, res) => {
  res.send('LINE Income/Expense Bot is running!');
});

app.post('/webhook', middleware(config), (req, res) => {
  console.log("📥 Webhook called!");
  console.log(JSON.stringify(req.body, null, 2));

  const events = req.body.events;
  if (!Array.isArray(events)) {
    console.error("❌ No events array in body");
    return res.sendStatus(400);
  }

  Promise.all(events.map(event => {
    console.log("📩 Event:", event);

    if (event.type === 'message' && event.message.type === 'text') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณส่งข้อความว่า: ${event.message.text}`,
      }).catch(err => {
        console.error("🔥 Reply error:", err);
      });
    } else {
      console.log('⚠️ Unhandled event type:', event.type);
      return Promise.resolve();
    }
  }))
  .then(() => {
    res.sendStatus(200);
  })
  .catch(err => {
    console.error("🔥 Error in Promise.all:", err);
    res.sendStatus(500);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
