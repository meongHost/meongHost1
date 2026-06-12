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
// AUTO EXTRACT VARIABLES
// format: key:value
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
// {{key}} replacer
// ======================
function renderTemplate(html, vars) {
  let output = html;

  for (const key in vars) {
    const reg = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    output = output.replace(reg, vars[key]);
  }

  return output;
}

// ======================
// WRAP HTML FINAL
// ======================
function wrapHtml(subjek, content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${subjek}</title>
</head>

<body style="margin:0;background:#0f172a;font-family:Arial;color:#e5e7eb;padding:20px">

  <div style="max-width:700px;margin:auto;background:#111827;padding:20px;border-radius:10px">

    <h2>${subjek}</h2>

    <div>
      ${content}
    </div>

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
    const subjek = body.subjek || "";
    const pesan = body.pesan || "";

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    // STEP 1: extract variables
    const vars = extractVars(pesan);

    // STEP 2: render template (optional {{var}})
    const rendered = renderTemplate(pesan, vars);

    // STEP 3: wrap HTML
    const finalHtml = wrapHtml(subjek, rendered);

    // STEP 4: send to all URLs
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
      subjek,
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
