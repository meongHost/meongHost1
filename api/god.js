const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// ======================
// LOAD URLS
// ======================
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

// ======================
// SAVE URLS
// ======================
function saveUrls(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ======================
// PARSE BODY
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// CLEAN TEXT
// ======================
function clean(str = "") {
  return String(str)
    .replace(/<[^>]*>/g, "")
    .trim();
}

// ======================
// AUTO EXTRACT ALL VARS FROM HTML / TEXT
// ======================
function extractAllVars(input = "") {
  const text = String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");

  const vars = {};

  // key: value / key = value
  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n]+)/g;
  let m;

  while ((m = regex.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();
    vars[key] = value;
  }

  // table detection <td>key</td><td>value</td>
  const tdRegex = /<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi;

  while ((m = tdRegex.exec(input)) !== null) {
    const key = m[1].replace(/<[^>]*>/g, "").toLowerCase().trim();
    const value = m[2].replace(/<[^>]*>/g, "").trim();
    if (key) vars[key] = value;
  }

  return vars;
}

// ======================
// BUILD HTML (BACKEND ONLY)
// ======================
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial;background:#0f172a;color:#fff;padding:20px">

<h2 style="color:#38bdf8">🚨 SYSTEM ALERT</h2>

<table style="width:100%;background:#1e293b;padding:15px;border-radius:10px">

<tr><td><b>User</b></td><td>${vars.user || "-"}</td></tr>
<tr><td><b>Email</b></td><td>${vars.email || "-"}</td></tr>
<tr><td><b>Phone</b></td><td>${vars.phone || "-"}</td></tr>
<tr><td><b>IP</b></td><td>${vars.ip || "-"}</td></tr>
<tr><td><b>Device</b></td><td>${vars.device || "-"}</td></tr>
<tr><td><b>Time</b></td><td>${vars.time || "-"}</td></tr>

</table>

</body>
</html>
`;
}

// ======================
// MAIN HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = parseBody(req);

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // URL MANAGER
    // ======================
    if (action === "add-url") {
      if (!body.url) return res.json({ success: false, message: "URL kosong" });

      if (!urls.includes(body.url)) {
        urls.push(body.url);
        saveUrls(urls);
      }

      return res.json({ success: true, urls });
    }

    if (action === "delete-url") {
      urls = urls.filter(x => x !== body.url);
      saveUrls(urls);
      return res.json({ success: true, urls });
    }

    if (action === "list-url") {
      return res.json({ success: true, urls });
    }

    // ======================
    // INPUT
    // ======================
    const subjek = clean(body.subjek || "");
    const sender = clean(body.sender || "system");
    const messageRaw = body.message || body.pesan || "";

    if (!subjek || !messageRaw) {
      return res.status(400).json({
        success: false,
        message: "subjek & message wajib diisi"
      });
    }

    // ======================
    // AUTO EXTRACT VARIABLES
    // ======================
    const vars = extractAllVars(messageRaw);

    vars.time = new Date().toISOString();
    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    // ======================
    // GENERATE HTML ONLY FROM BACKEND
    // ======================
    const html = buildHtml(vars);

    const payload = new URLSearchParams({
      subjek,
      pesan: html,
      sender
    }).toString();

    const fetchFn = global.fetch || require("node-fetch");

    const results = [];

    for (const url of urls) {
      try {
        const r = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload
        });

        results.push({
          url,
          status: r.status,
          success: r.ok
        });
      } catch (err) {
        results.push({
          url,
          success: false,
          error: err.message
        });
      }
    }

    return res.json({
      success: true,
      message: "sent",
      vars,
      total: urls.length,
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
