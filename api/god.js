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
// PARSE BODY (SAFE VERCEL)
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// TEMPLATE ENGINE ($var)
// ======================
function render(str, vars) {
  return String(str).replace(/\$(\w+)/g, (_, k) => vars[k] ?? "");
}

// ======================
// HTML TEMPLATE (SERVER ONLY)
// ======================
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>System Alert</title>
</head>
<body style="margin:0;padding:20px;font-family:Arial;background:#0f172a;color:#fff">

<h2 style="color:#38bdf8">🚨 SYSTEM ALERT</h2>

<table style="width:100%;background:#1e293b;padding:15px;border-radius:10px">
<tr><td><b>Subject</b></td><td>${vars.subjek}</td></tr>
<tr><td><b>User</b></td><td>${vars.sender}</td></tr>
<tr><td><b>IP</b></td><td>${vars.ip}</td></tr>
<tr><td><b>Time</b></td><td>${vars.time}</td></tr>
</table>

<br>

<div style="background:#111827;padding:15px;border-radius:10px">
${vars.message}
</div>

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
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url)
        return res.status(400).json({ success: false, message: "URL wajib" });

      if (!urls.includes(body.url)) urls.push(body.url);
      saveUrls(urls);

      return res.json({ success: true, urls });
    }

    // ======================
    // DELETE URL
    // ======================
    if (action === "delete-url") {
      urls = urls.filter(x => x !== body.url);
      saveUrls(urls);
      return res.json({ success: true, urls });
    }

    // ======================
    // LIST URL
    // ======================
    if (action === "list-url") {
      return res.json({ success: true, total: urls.length, urls });
    }

    // ======================
    // SEND MODE
    // ======================
    const subjek = body.subjek || "";
    const sender = body.sender || "system";
    const message = body.message || body.pesan || "";

    if (!subjek) {
      return res.status(400).json({
        success: false,
        message: "subjek wajib diisi"
      });
    }

    // ======================
    // AUTO VARIABLES
    // ======================
    const vars = {
      subjek,
      sender,
      ip:
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown",
      time: new Date().toISOString(),
      message
    };

    // ======================
    // BUILD HTML FROM BACKEND
    // ======================
    const html = buildHtml(vars);

    const payload = new URLSearchParams({
      subjek: render(subjek, vars),
      pesan: html,
      sender
    }).toString();

    const fetchFn = global.fetch || require("node-fetch");

    const results = [];

    for (const url of urls) {
      try {
        const r = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: payload
        });

        results.push({
          url,
          status: r.status,
          success: r.ok
        });
      } catch (e) {
        results.push({
          url,
          success: false,
          error: e.message
        });
      }
    }

    return res.json({
      success: true,
      message: "sent",
      total: urls.length,
      vars,
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
