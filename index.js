const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const app = express();
const PORT = process.env.PORT || 4000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// middleware เช็ค signature จาก LINE
// ถ้าไม่มี header x-line-signature จะข้าม (สำหรับทดสอบ)
function safeMiddleware(req, res, next) {
  if (!req.headers['x-line-signature']) {
    // ไม่มี signature ให้ข้าม (อาจเป็นการทดสอบ)
    next();
  } else {
    // มี signature ให้ใช้ middleware ของ line-sdk ตรวจสอบ
    return middleware(config)(req, res, next);
  }
}

app.use(express.json());

app.get('/', (req, res) => {
  res.send('LINE Income/Expense Bot is running!');
});

app.post('/webhook', middleware(config), (req, res) => {
  console.log("📥 Webhook called!");
  console.log(JSON.stringify(req.body, null, 2)); // แสดง payload ทั้งก้อน

  const events = req.body.events;
  if (!Array.isArray(events)) return res.sendStatus(400);

  Promise.all(events.map(event => {
    console.log("📩 Event:", event);

    if (event.type === 'message' && event.message.type === 'text') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณส่งข้อความว่า: ${event.message.text}`,
      });
    } else {
      console.log('⚠️ Unhandled event type:', event.type);
      return Promise.resolve(null);
    }
  }))
  .then(() => res.sendStatus(200))
  .catch(err => {
    console.error("🔥 Error:", err);
    res.sendStatus(500);
  });
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
