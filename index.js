const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// OpenAI
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

// Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userText = event.message.text;

      try {
        // 👇 ส่งไปให้ ChatGPT จัดรูปแบบ
        const gptRes = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "แปลงข้อความเป็น JSON: {date, type, item, amount}" },
            { role: "user", content: userText }
          ]
        });

        const replyJSON = gptRes.data.choices[0].message.content;
        const data = JSON.parse(replyJSON);

        console.log("📄 Data from GPT:", data);

        // 👇 เขียนลง Google Sheets
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Sheet1!A:D',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[data.date, data.type, data.item, data.amount]]
          }
        });

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `✅ บันทึกเรียบร้อย: ${data.item} ${data.amount} บาท`
        });

      } catch (err) {
        console.error("🔥 Error:", err);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `❌ เกิดข้อผิดพลาด: ${err.message}`
        });
      }
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
