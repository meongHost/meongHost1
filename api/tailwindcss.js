const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const fetch =
  global.fetch ||
  require("node-fetch");

const CONFIG = {

  // =========================
  // TELEGRAM
  // =========================
  botToken:
    "8217529543:AAFXmZRDhu-2BihyGkK-viqJjnezybXMcdk",

  chatId:
    "8428689901",

  // =========================
  // API
  // =========================
  apiKey:
    "tailwindcss",

  // =========================
  // LIMIT
  // =========================
  rateLimit:
    60,

  maxLength:
    5000,

  maxRequestPerIP:
    10,

  requestWindow:
    60 * 1000,

  // =========================
  // STORAGE
  // =========================
  storage:
    path.join(
      "/tmp",
      "sent_data.json"
    )
};

// =========================
// MEMORY RATE LIMIT
// =========================
const ipCache =
  new Map();

// =========================
// STORAGE
// =========================
function loadStorage() {

  try {

    if (
      !fs.existsSync(
        CONFIG.storage
      )
    ) {

      fs.writeFileSync(
        CONFIG.storage,
        JSON.stringify([])
      );

    }

    const raw =
      fs.readFileSync(
        CONFIG.storage,
        "utf8"
      );

    const data =
      JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];

  } catch {

    return [];
  }
}

function saveStorage(data) {

  try {

    fs.writeFileSync(
      CONFIG.storage,
      JSON.stringify(
        data,
        null,
        2
      )
    );

  } catch {}
}

// =========================
// HASH
// =========================
function sha256(input) {

  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex");
}

// =========================
// ESCAPE MARKDOWN
// =========================
function escapeMarkdown(
  text = ""
) {

  return text.replace(
    /[_*[\]()~`>#+=|{}.!-]/g,
    "\\$&"
  );
}

// =========================
// SANITIZE
// =========================
function sanitizeInput(
  text = ""
) {

  return String(text)

    .replace(
      /<[^>]*>?/gm,
      ""
    )

    .replace(/\0/g, "")

    .trim();
}

// =========================
// DETECT ATTACK
// =========================
function detectFlags(text = "") {

  const flags = []

  const lower =
    text.toLowerCase()

  // SQLI
  const sqlPatterns = [
    "select *",
    "union select",
    "drop table",
    "insert into",
    "' or '1'='1",
    "--",
    ";--"
  ]

  // XSS
  const xssPatterns = [
    "<script",
    "javascript:",
    "onerror=",
    "alert(",
    "<img"
  ]

  // SHELL
  const shellPatterns = [
    "rm -rf",
    "wget ",
    "curl ",
    "bash ",
    "chmod 777",
    "exec("
  ]

  // LOOP SQLI
  for (const p of sqlPatterns) {

    if (lower.includes(p)) {
      flags.push("SQLI")
      break
    }
  }

  // LOOP XSS
  for (const p of xssPatterns) {

    if (lower.includes(p)) {
      flags.push("XSS")
      break
    }
  }

  // LOOP SHELL
  for (const p of shellPatterns) {

    if (lower.includes(p)) {
      flags.push("SHELL")
      break
    }
  }

  // SPAM
  if (
    text.length > 1000
  ) {
    flags.push("SPAM")
  }

  return flags
}

// =========================
// GET IP
// =========================
function getClientIP(req) {

  return (

    req.headers[
      "cf-connecting-ip"
    ] ||

    req.headers[
      "x-real-ip"
    ] ||

    req.headers[
      "x-forwarded-for"
    ] ||

    req.socket
      ?.remoteAddress ||

    "unknown"

  )

    .split(",")[0]

    .trim();
}

// =========================
// RATE LIMIT
// =========================
function isRateLimited(ip) {

  const now =
    Date.now();

  if (
    !ipCache.has(ip)
  ) {

    ipCache.set(ip, []);

  }

  const requests =
    ipCache.get(ip)

      .filter(
        t =>
          now - t <
          CONFIG.requestWindow
      );

  requests.push(now);

  ipCache.set(
    ip,
    requests
  );

  return (
    requests.length >
    CONFIG.maxRequestPerIP
  );
}

// =========================
// TELEGRAM SEND
// =========================
async function sendTelegram(
  message,
  ket
) {

  const url =
`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;

  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        chat_id:
          CONFIG.chatId,

        text:
          message,

        parse_mode:
          "MarkdownV2",

        disable_web_page_preview:
          true,

        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📋 Copy Payload",
                copy_text: {
                  text: ket
                }
              }
            ]
          ]
        }
      })
    });

  if (!response.ok) {

    const err =
      await response.text();

    throw new Error(
      `Telegram Error: ${err}`
    );
  }

  return true;
}

async function forwardToApi(ket, ip) {
  const params = new URLSearchParams();

  const waktu = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta"
  });

  params.append(
    "subjek",
    `[SECURITY] Payload Report - ${ip}` // ✅ pakai backtick
  );

  params.append(
  "pesan",
  `<h3>🚨 JOEST27 SECURITY REPORT</h3>

<b>📡 REQUEST INFORMATION</b><br>
IP Address : ${ip}<br>
Timestamp  : ${waktu}<br><br>

<b>📄 PAYLOAD</b><br>
${ket || "-"}<br><br>

<b>🛡 ANALYSIS</b><br>
Status : CLEAN<br>
Source : API Gateway<br>
System : JOEST27 Protection<br><br>

<hr>
<small>Generated Automatically</small>`
);
  params.append("sender", ip);

  try {
    const response = await fetch(
      "https://abgjago.sisherif.codes/api.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    if (!response.ok) {
      throw new Error(`Forward API Error: ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
}

// =========================
// MAIN EXPORT
// =========================
module.exports =
async (req, res) => {

  res.setHeader(
    "Content-Type",
    "application/json"
  );

  // =========================
  // SECURITY HEADER
  // =========================
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  res.setHeader(
    "X-XSS-Protection",
    "1; mode=block"
  );

  try {

    // =========================
    // METHOD GET ONLY
    // =========================
    if (
      req.method !== "GET"
    ) {

      return res.status(405).json({

        status: 405,

        title:
          "Method Ditolak",

        msg:
          "Gunakan method GET."
      });

    }

    // =========================
    // API KEY
    // =========================
    const clientApiKey =

      req.query.apikey ||

      req.headers[
        "x-api-key"
      ] ||

      "";

    if (
      clientApiKey !==
      CONFIG.apiKey
    ) {

      return res.status(403).json({

        status: 403,

        title:
          "Akses Ditolak",

        msg:
          "API key tidak valid."
      });

    }

    // =========================
    // INPUT
    // =========================
    let ket =

      req.query.ket ||

      "";

    ket =
      sanitizeInput(ket);

    const ip =
      getClientIP(req);

    // =========================
    // VALIDASI
    // =========================
    if (!ket) {

      return res.status(400).json({

        status: 400,

        title:
          "Data Kosong",

        msg:
          "Field ket wajib diisi."
      });

    }

    if (
      ket.length < 3
    ) {

      return res.status(400).json({

        status: 400,

        title:
          "Data Pendek",

        msg:
          "Minimal 3 karakter."
      });

    }

    if (
      ket.length >
      CONFIG.maxLength
    ) {

      return res.status(400).json({

        status: 400,

        title:
          "Data Panjang",

        msg:
          "Melebihi batas maksimum."
      });

    }

    // =========================
    // DETECT DANGER
    // =========================
    const dangerFlags =
      detectFlags(ket)

    if (
      dangerFlags.includes("SQLI") ||
      dangerFlags.includes("XSS") ||
      dangerFlags.includes("SHELL")
    ) {

      return res.status(403).json({

        status: 403,

        title:
          "Payload Berbahaya",

        msg:
          "Request terdeteksi berbahaya.",

        flags:
          dangerFlags
      })
    }

    // =========================
    // RATE LIMIT
    // =========================
    if (
      isRateLimited(ip)
    ) {

      return res.status(429).json({

        status: 429,

        title:
          "Rate Limit",

        msg:
          "Terlalu banyak request."
      });

    }

    // =========================
    // STORAGE
    // =========================
    const stored =
      loadStorage();

    const now =
      Math.floor(
        Date.now() / 1000
      );

    const hash =
      sha256(ket);

    // =========================
    // DUPLIKAT
    // =========================
    const duplicate =
      stored.find(
        x =>
          x.hash === hash
      );

    if (duplicate) {

      return res.status(409).json({

        status: 409,

        title:
          "Duplikat",

        msg:
          "Data sudah pernah dikirim."
      });

    }

    // =========================
    // RATE LIMIT BY IP
    // =========================
    const recent =
      stored.find(

        x =>

          x.ip === ip &&

          now - x.time <
          CONFIG.rateLimit
      );

    if (recent) {

      return res.status(429).json({

        status: 429,

        title:
          "Terlalu Cepat",

        msg:
          "Tunggu sebelum mengirim ulang."
      });

    }

    // =========================
    // FORMAT MESSAGE
    // =========================
    const waktu =
      new Date()

        .toLocaleString(
          "id-ID",
          {
            timeZone:
              "Asia/Jakarta"
          }
        );

    const flags =
      detectFlags(ket)

    const status =
      flags.length > 0
        ? "⚠️ SUSPICIOUS"
        : "✅ CLEAN"

    const flagText =
      flags.length > 0
        ? flags.join(", ")
        : "NONE"

    let message =
`
╭━━━━━━━━━━━━━━━━━━⬣
┃ 🚨 *JOEST27 SECURITY*
╰━━━━━━━━━━━━━━━━━━⬣

┌〔 📡 REQUEST INFO 〕
┃ 🌐 IP :
┃ ${escapeMarkdown(ip)}
┃
┃ 🕒 Waktu :
┃ ${escapeMarkdown(waktu)}
└──────────────⬣

┌〔 🛡 SECURITY STATUS 〕
┃ ${escapeMarkdown(status)}
┃
┃ 🚩 Flag :
┃ ${escapeMarkdown(flagText)}
└──────────────⬣

┌〔 📄 PAYLOAD 〕
${escapeMarkdown(ket)}
└──────────────⬣

╭━━━━━━━━━━━━━━━━━━⬣
┃ 🤖 JOEST27 PROTECTION
╰━━━━━━━━━━━━━━━━━━⬣
`;

    // =========================
    // SEND TELEGRAM
    // =========================
    await sendTelegram(
  message,
  ket
);

await forwardToApi(
  ket,
  ip
);

    // =========================
    // SAVE STORAGE
    // =========================
    stored.push({

      hash,

      ip,

      time:
        now
    });

    // =========================
    // AUTO CLEANUP
    // =========================
    const cleaned =
      stored.filter(

        x =>

          now - x.time <
          86400
      );

    saveStorage(cleaned);

    // =========================
    // SUCCESS
    // =========================
    return res.status(200).json({

      status: 200,

      title:
        "Berhasil",

      msg:
        "Pesan berhasil dikirim."
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      status: 500,

      title:
        "Server Error",

      msg:
        "Terjadi kesalahan pada server."

    });

  }
};
