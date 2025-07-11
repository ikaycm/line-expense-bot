require("dotenv").config();

const express = require("express");
const { Client, middleware } = require("@line/bot-sdk");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

// LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);

// Google Sheets config
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// OpenRouter endpoint
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.get("/", (req, res) => {
  res.send("✅ LINE Expense Bot + OpenRouter + Sheets is running!");
});

app.post("/webhook", middleware(lineConfig), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userText = event.message.text;
      console.log("📥 รับข้อความจาก LINE:", userText);

      try {
        // 👉 ส่งไปถาม OpenRouter (เช่น Gemini 2.0 หรือ Mistral)
        const gptRes = await axios.post(
          OPENROUTER_URL,
          {
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
              {
                role: "system",
                content:
                  "แปลงข้อความที่เกี่ยวกับรายรับรายจ่ายเป็น JSON ที่มีคีย์: date, type (expense/income), item, amount เช่น 'บันทึกรายจ่าย วันนี้ ข้าวเช้า 50 บาท' → {\"date\": \"2025-07-11\", \"type\": \"expense\", \"item\": \"ข้าวเช้า\", \"amount\": 50} เท่านั้น อย่าใส่คำอื่น"
              },
              { role: "user", content: userText }
            ]
          },
          {
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        let replyJSON = gptRes.data.choices[0].message.content.trim();
        console.log("🤖 คำตอบจาก AI:", replyJSON);

        // 👉 ทำความสะอาดข้อความก่อน parse
        replyJSON = sanitizeJSON(replyJSON);

        let data;
        try {
          data = JSON.parse(replyJSON);
        } catch (err) {
          throw new Error(`❌ ไม่สามารถแปลง JSON ได้: ${replyJSON}`);
        }

        // 👉 เขียนลง Google Sheets
        const authClient = await auth.getClient();
        await sheets.spreadsheets.values.append({
          auth: authClient,
          spreadsheetId: SPREADSHEET_ID,
          range: "Sheet1!A:D",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[data.date, data.type, data.item, data.amount]]
          }
        });
        console.log("✅ บันทึกลง Google Sheets เรียบร้อย:", data);

        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: `✅ บันทึกแล้ว: ${data.item} ${data.amount} บาท`
        });
      } catch (err) {
        console.error("🔥 ERROR:", err);
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: `❌ เกิดข้อผิดพลาด: ${err.message}`
        });
      }
    }
  }

  res.sendStatus(200);
});

// ฟังก์ชัน sanitize JSON string
function sanitizeJSON(str) {
  let clean = str.trim();

  // ลบ backtick, single-quote, double-quote รอบนอกถ้ามี
  if (
    (clean.startsWith("`") && clean.endsWith("`")) ||
    (clean.startsWith("'") && clean.endsWith("'")) ||
    (clean.startsWith('"') && clean.endsWith('"'))
  ) {
    clean = clean.slice(1, -1).trim();
  }

  // แปลง single-quote ภายในเป็น double-quote
  clean = clean.replace(/'/g, '"');

  // ลบ newline และช่องว่างส่วนเกิน
  clean = clean.replace(/\n/g, "").replace(/\s{2,}/g, " ");

  // เอาเฉพาะส่วนที่เป็น {...} หรือ [{...}]
  const match = clean.match(/(\{.*\}|\[.*\])/s);
  if (match) return match[0];

  return clean;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
