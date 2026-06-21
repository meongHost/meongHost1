import crypto from "crypto";

const duplicateStore = global.duplicateStore || new Map();
global.duplicateStore = duplicateStore;

export default async function handler(req, res) {
try {
if (req.method !== "POST") {
return res.status(405).json({
success: false,
message: "Method Not Allowed"
});
}

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

const brand = "Pusat Nya Stok🤤";
const linkWa =
  "https://whatsapp.com/channel/0029VbCGetE7j6gAzSHSEj04";

const warning =
  "HATI HATI TERHADAP PANEL YANG MENGATASNAMAKAN FAREL GEN02 • WASPADA TERHADAP PIHAK YANG TIDAK BERTANGGUNG JAWAB!";

const fingerprint = crypto
  .createHash("md5")
  .update(subjek + pesan)
  .digest("hex");

const now = Date.now();
const duplicateWindow = 5 * 60 * 1000;

const last = duplicateStore.get(fingerprint);

if (
  last &&
  now - last < duplicateWindow
) {
  return res.status(409).json({
    success: false,
    message: "Duplicate payload detected"
  });
}

duplicateStore.set(
  fingerprint,
  now
);

const targets = [
  /REAL KHA|KHA/gi,
  /RESULT BY RUL HOSTING|RESSULT BY RUL HOSTING/gi,
  /RUL HOSTING/gi,
  /\bRUL\b/gi,
  /Grudabest/gi,
  /JUNN HOSTING/gi,
  /GanzzNesia62/gi,
  /LiFFCcG|BanGLiFF|LiFFNesia|NUSA ID|ITSMEHER|CAHYO SR/gi
];

let cleanSubject = subjek;
let cleanMessage = pesan;

for (const regex of targets) {
  cleanSubject =
    cleanSubject.replace(regex, brand);

  cleanMessage =
    cleanMessage.replace(regex, brand);
}

cleanMessage = cleanMessage.replace(
  /Information EMAIL\/PHONE\/USERNAME/gi,
  warning
);

cleanMessage =
  `<div style="background:#ff0000;color:#fff;padding:10px;text-align:center;font-weight:bold;">${warning}</div>` +
  cleanMessage;

cleanMessage += `
  <div style="margin-top:20px;text-align:center;">
    <a href="${linkWa}">
      BUY UNCHEK DISINI
    </a>
  </div>
`;

return res.status(200).json({
  success: true,
  request_id: crypto.randomUUID(),
  sender,
  data: {
    subject: cleanSubject,
    content: cleanMessage
  }
});

} catch (err) {
return res.status(500).json({
success: false,
message: err.message
});
}
}
