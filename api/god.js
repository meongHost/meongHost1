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
// STRIP HTML (SAFE)
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// EXTRACT VARIABLES (NO LIMIT HTML)
// ======================
function extractVars(input = "") {
  const text = stripHtml(input);

  const vars = {};
  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n]+)/g;

  let m;
  while ((m = regex.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();

    if (key && value) {
      vars[key] = value;
    }
  }

  return vars;
}

// ======================
// BACKEND TEMPLATE (CLEAN OUTPUT)
// ======================
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial;background:#0f172a;color:#fff;padding:20px">

<h2 style="color:#38bdf8">🚨 SYSTEM ALERT</h2>

<table style="width:100%;background:#1e293b;padding:15px;border-radius:10px">

<tr><td>User</td><td>${vars.user || "-"}</td></tr>
<tr>
  <td>Contact</td>
  <td>
    ${(vars.email || "-")} ${vars.phone ? " | " + vars.phone : ""}
  </td>
</tr>
<tr><td>IP</td><td>${vars.ip || "-"}</td></tr>
<tr><td>Device</td><td>${vars.device || "-"}</td></tr>
<tr><td>Time</td><td>${vars.time || "-"}</td></tr>

</table>

</body>
</html>
`;
}

// ======================
// MAIN API
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body = parseBody(req);

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url) {
        return res.json({ success: false, message: "URL kosong" });
      }

      if (!urls.includes(body.url)) {
        urls.push(body.url);
        saveUrls(urls);
      }

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
      return res.json({ success: true, urls });
    }

    // ======================
    // INPUT DATA (HTML ALLOWED)
    // ======================
    const subjek = body.subjek || "";
    const sender = body.sender || "system";
    const messageRaw = body.message || body.pesan || body.pesan_html || "";

    if (!subjek || !messageRaw) {
      return res.status(400).json({
        success: false,
        message: "subjek & message wajib diisi"
      });
    }

    // ======================
    // EXTRACT VARIABLES FROM HTML/TEXT
    // ======================
    const vars = extractVars(messageRaw);

    vars.time = new Date().toISOString();
    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    // ======================
    // BUILD CLEAN HTML (NO USER HTML USED)
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
