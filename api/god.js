const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// ======================
// LOAD / SAVE URLS
// ======================
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

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
// AUTO EXTRACT VARS (key:value)
// ======================
function extractVars(text = "") {
  const vars = {};
  const regex = /([a-zA-Z0-9_]+)\s*:\s*([^\n<]+)/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].toLowerCase().trim();
    const value = match[2].trim();
    vars[key] = value;
  }

  return vars;
}

// ======================
// SIMPLE TEMPLATE ENGINE
// {{key}} replacement
// ======================
function renderTemplate(html, vars) {
  let out = html;

  for (const key in vars) {
    const reg = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    out = out.replace(reg, vars[key]);
  }

  return out;
}

// ======================
// BASIC HTML WRAPPER
// ======================
function wrapHtml(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
</head>
<body style="font-family:Arial;background:#0f172a;color:#e5e7eb;padding:20px">

<div style="max-width:700px;margin:auto;background:#111827;padding:20px;border-radius:10px">

  <h2 style="margin-top:0">${title}</h2>

  ${content}

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
    // LIST URL
    // ======================
    if (action === "list-url") {
      return res.json({ success: true, urls });
    }

    // ======================
    // SEND NOTIFICATION
    // ======================
    const subjek = body.subjek || "Notification";
    const message = body.message || "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message required"
      });
    }

    // STEP 1: extract variables
    const vars = extractVars(message);

    // STEP 2: render template
    const htmlBody = renderTemplate(message, vars);

    // STEP 3: wrap final html
    const finalHtml = wrapHtml(subjek, htmlBody);

    // STEP 4: send to all urls
    const fetchFn = global.fetch || require("node-fetch");

    const results = [];

    for (const url of urls) {
      try {
        const r = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            subjek,
            pesan: finalHtml
          })
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
