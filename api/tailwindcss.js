const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONFIG = {
botToken: "8217529543:AAFXmZRDhu-2BihyGkK-viqJjnezybXMcdk",
chatId: "8428689901",
apiKey: "tailwindcss",
rateLimit: 60,
maxLength: 5000,
storage: path.join("/tmp", "sent_data.json")
};

function loadStorage() {
try {
if (!fs.existsSync(CONFIG.storage)) {
fs.writeFileSync(CONFIG.storage, JSON.stringify([]));
}
const data = JSON.parse(fs.readFileSync(CONFIG.storage, "utf8"));
return Array.isArray(data) ? data : [];
} catch {
return [];
}
}

function saveStorage(data) {
try {
fs.writeFileSync(CONFIG.storage, JSON.stringify(data, null, 2));
} catch {}
}

function sha256(input) {
return crypto.createHash("sha256").update(input).digest("hex");
}

async function sendTelegram(message) {
const url = https://api.telegram.org/bot${CONFIG.botToken}/sendMessage;

const response = await fetch(url, {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
chat_id: CONFIG.chatId,
text: message,
parse_mode: "Markdown"
})
});

return response.ok;
}

module.exports = async (req, res) => {
res.setHeader("Content-Type", "application/json");

try {
const clientApiKey = req.query.apikey || req.headers["x-api-key"] || "";

if (clientApiKey !== CONFIG.apiKey) {  
  return res.status(403).json({  
    status: 403,  
    title: "Akses Ditolak",  
    msg: "API key tidak valid."  
  });  
}  

const ket = String(req.query.ket || req.body?.ket || "").trim();  
const ip = (  
  req.headers["x-forwarded-for"] ||  
  req.socket?.remoteAddress ||  
  "unknown"  
).split(",")[0].trim();  

if (!ket) {  
  return res.status(400).json({  
    status: 400,  
    title: "Data Kosong",  
    msg: "Field ket wajib diisi."  
  });  
}  

if (ket.length < 3) {  
  return res.status(400).json({  
    status: 400,  
    title: "Data Terlalu Pendek",  
    msg: "Minimal 3 karakter."  
  });  
}  

if (ket.length > CONFIG.maxLength) {  
  return res.status(400).json({  
    status: 400,  
    title: "Data Terlalu Panjang",  
    msg: "Melebihi batas maksimum."  
  });  
}  

const stored = loadStorage();  
const currentTime = Math.floor(Date.now() / 1000);  
const hash = sha256(ket);  

for (const entry of stored) {  
  if (entry.hash === hash) {  
    return res.status(409).json({  
      status: 409,  
      title: "Duplikat Terdeteksi",  
      msg: "Data yang sama sudah pernah dikirim."  
    });  
  }  
}  

for (const entry of stored) {  
  if (  
    entry.ip === ip &&  
    currentTime - entry.time < CONFIG.rateLimit  
  ) {  
    return res.status(429).json({  
      status: 429,  
      title: "Terlalu Cepat",  
      msg: "Tunggu sebelum mengirim ulang."  
    });  
  }  
}  

const waktu = new Date().toLocaleString("id-ID", {  
  timeZone: "Asia/Jakarta"  
});  

let message = "📩 *JastebGod*\n";  
message += `🕒 *Waktu:* ${waktu}\n`;  
message += `🌐 *IP:* ${ip}\n\n`;  
message += ket;  

const sent = await sendTelegram(message);  

if (!sent) {  
  return res.status(500).json({  
    status: 500,  
    title: "Gagal",  
    msg: "Pesan gagal dikirim ke Telegram."  
  });  
}  

stored.push({  
  hash,  
  ip,  
  time: currentTime  
});  

saveStorage(stored);  

return res.status(200).json({  
  status: 200,  
  title: "Berhasil",  
  msg: "Pesan berhasil dikirim."  
});

} catch {
return res.status(500).json({
status: 500,
title: "Server Error",
msg: "Terjadi kesalahan pada server."
});
}
};
