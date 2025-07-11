const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const app = express();
const PORT = process.env.PORT || 10000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// ใช้ middleware ตรวจสอบ signature LINE (แนะนำสำหรับ production)
app.use(middleware(config));
app.use(express.json());

// Route สำหรับเช็คสถานะเซิร์ฟเวอร์
app.get('/', (req, res) => {
  res.send('LINE Income/Expense Bot is running!');
});

// webhook endpoint
app.post('/webhook', (req, res) => {
  const events = req.body.events;
  if (!events) {
    return res.sendStatus(400);
  }

  Promise.all(events.map(async (event) => {
    // เฉพาะ event ข้อความแบบ text เท่านั้น
    if (event.type === 'message' && event.message.type === 'text') {
      try {
        // ตอบกลับข้อความเดิม
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `คุณส่งข้อความว่า: ${event.message.text}`,
        });
      } catch (err) {
        console.error('Reply error:', err);
      }
    }
    // กรณี event อื่นๆ ไม่ต้องทำอะไร แค่ resolve
    return null;
  }))
  .then(() => res.sendStatus(200))
  .catch(err => {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
