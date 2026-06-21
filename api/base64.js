import crypto from "crypto";

const duplicateStore = global.duplicateStore || new Map();
const rateLimitStore = global.rateLimitStore || new Map();

global.duplicateStore = duplicateStore;
global.rateLimitStore = rateLimitStore;

export default async function handler(req, res) {
const start = Date.now();

try {
if (req.method !== "POST") {
return res.status(405).json({
success: false,
message: "Method Not Allowed"
});
}

const ip =
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.socket?.remoteAddress ||
  "unknown";

// =====================
// RATE LIMIT
// =====================

const limitWindow = 60 * 1000;
const maxRequest = 10;

const requests =
  rateLimitStore.get(ip)?.filter(
    t => Date.now() - t < limitWindow
  ) || [];

if (requests.length >= maxRequest) {
  return res.status(429).json({
    success: false,
    message: "Too Many Requests"
  });
}

requests.push(Date.now());
rateLimitStore.set(ip, requests);

// =====================
// INPUT
// =====================

const {
  subjek = "",
  pesan = "",
  sender = ""
} = req.body || {};

if (!subjek || !pesan) {
  return res.status(400).json({
    success: false,
    message: "Subjek dan pesan wajib diisi"
  });
}

if (pesan.length > 500000000) {
  return res.status(413).json({
    success: false,
    message: "Payload terlalu besar"
  });
}

// =====================
// DUPLICATE CHECK
// =====================

const fingerprint = crypto
  .createHash("md5")
  .update(subjek + pesan)
  .digest("hex");

const duplicateWindow =
  5 * 60 * 1000;

const last =
  duplicateStore.get(fingerprint);

if (
  last &&
  Date.now() - last < duplicateWindow
) {
  return res.status(409).json({
    success: false,
    message:
      "Duplicate payload detected"
  });
}

duplicateStore.set(
  fingerprint,
  Date.now()
);

// cleanup

for (const [key, value] of duplicateStore) {
  if (
    Date.now() - value >
    duplicateWindow
  ) {
    duplicateStore.delete(key);
  }
}

// =====================
// REBRANDING
// =====================

const brand =
  "Pusat Nya Stok🤤";

const linkWa =
  "https://whatsapp.com/channel/0029VbCGetE7j6gAzSHSEj04";

const warning =
  "HATI HATI TERHADAP PANEL YANG MENGATASNAMAKAN FAREL GEN02 • WASPADA TERHADAP PIHAK YANG TIDAK BERTANGGUNG JAWAB!";

const targets = [
  /REAL KHA|KHA/gi,
  /RESULT BY RUL HOSTING|RESSULT BY RUL HOSTING/gi,
  /RUL HOSTING/gi,
  /\bRUL\b/gi,
  /Grudabest/gi,
  /JUNN HOSTING/gi,
  /GanzzNesia62/gi,
  /LiFFCcG|BanGLiFF|LiFFNesia|NUSA ID|ITSMEHER|CAHYO SR/gi,
  /https?:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel)\/[A-Za-z0-9]+/gi
];

let cleanSubject = subjek;
let cleanMessage = pesan;

let replaceCount = 0;

for (const regex of targets) {
  const before = cleanMessage;

  cleanSubject =
    cleanSubject.replace(
      regex,
      brand
    );

  cleanMessage =
    cleanMessage.replace(
      regex,
      brand
    );

  if (before !== cleanMessage) {
    replaceCount++;
  }
}

cleanMessage = cleanMessage
  .replace(
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    ""
  )
  .replace(/onerror=/gi, "")
  .replace(/onclick=/gi, "");

cleanMessage =
  `<div style="background:#ff0000;color:#fff;padding:10px;text-align:center;font-weight:bold">${warning}</div>` +
  cleanMessage;

cleanMessage += `
  <div style="margin-top:20px;text-align:center">
    <a href="${linkWa}">
      BUY UNCHEK DISINI
    </a>
  </div>
`;

// =====================
// FORWARD
// =====================

const urls = [
  "https://abgjagonih.botmarket.biz.id/J/apiii.php",
  "https://domain2.com/api"
];

const dispatch =
  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },
          body:
            new URLSearchParams({
              subjek: cleanSubject,
              pesan: cleanMessage
            })
        });

        return {
          url,
          success: true,
          status: r.status
        };
      } catch (err) {
        return {
          url,
          success: false,
          error: err.message
        };
      }
    })
  );

return res.status(200).json({
  success: true,
  request_id:
    crypto.randomUUID(),
  sender,
  processing_ms:
    Date.now() - start,
  stats: {
    replacements:
      replaceCount
  },
  data: {
    subject: cleanSubject,
    content: cleanMessage
  },
  dispatch: dispatch.map(
    item =>
      item.status ===
      "fulfilled"
        ? item.value
        : {
            success: false,
            error:
              item.reason?.message
          }
  )
});

} catch (err) {
return res.status(500).json({
success: false,
message: err.message
});
}
}
