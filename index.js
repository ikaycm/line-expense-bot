require("dotenv").config();

const express = require("express");
const { Client, middleware } = require("@line/bot-sdk");
const OpenAI = require("openai");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

// LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);

// OpenRouter config
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Google Sheets config
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

app.get("/", (req, res) => {
  res.send("✅ LINE Expense Bot + OpenRouter is running!");
});

app.post("/webhook", middleware(lineConfig), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userText = event.message.text;
      console.log("📥 รับข้อความจาก LINE:", userText);

      try {
        // 👉 ส่งไปถาม OpenRouter (เช่น Mistral)
        const gptRes = await openai.chat.completions.create({
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                "แปลงข้อความที่เกี่ยวกับรายรับรายจ่ายเป็น JSON ที่มีคีย์: date, type (expense/income), item, amount เช่น 'บันทึกรายจ่าย วันนี้ ข้าวเช้า 50 บาท' → {\"date\": \"2025-07-11\", \"type\": \"expense\", \"item\": \"ข้าวเช้า\", \"amount\": 50}",
            },
            { role: "user", content: userText },
          ],
        });

        const replyJSON = gptRes.choices[0].message.content.trim();
        console.log("🤖 คำตอบจาก OpenRouter:", replyJSON);

        let data;
        try {
          data = JSON.parse(replyJSON);
        } catch (err) {
          throw new Error(`ไม่สามารถแปลง JSON ได้: ${replyJSON}`);
        }

        // 👉 เขียนลง Google Sheets
        const authClient = await auth.getClient();
        await sheets.spreadsheets.values.append({
          auth: authClient,
          spreadsheetId: SPREADSHEET_ID,
          range: "Sheet1!A:D",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[data.date, data.type, data.item, data.amount]],
          },
        });
        console.log("✅ บันทึกลง Google Sheets เรียบร้อย:", data);

        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: `✅ บันทึกแล้ว: ${data.item} ${data.amount} บาท`,
        });
      } catch (err) {
        console.error("🔥 ERROR:", err);
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: `❌ เกิดข้อผิดพลาด: ${err.message}`,
        });
      }
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
