const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ต้องเพิ่ม middleware นี้ เพื่อให้ express อ่าน JSON body ได้
app.use(express.json());

app.get('/', (req, res) => {
  res.send('LINE Income/Expense Bot is running!');
});

// เพิ่ม route รับ webhook POST
app.post('/webhook', (req, res) => {
  console.log('Received webhook:', req.body);

  // ตอบ 200 OK เพื่อให้ LINE รู้ว่า webhook ใช้งานได้
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
