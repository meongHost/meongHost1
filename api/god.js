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
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {}
}

// ======================
// BODY PARSER
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// TEMPLATE ENGINE
// ======================
function render(str, vars) {
  if (!str) return "";
  return String(str)
    .replace(/\$(\w+)/g, (_, k) => vars[k] ?? "")
    .replace(/\$\{d\.(\w+)\}/g, (_, k) => vars[k] ?? "")
    .replace(/\$\{.*?\}/g, "");
}

// ======================
// MAIN
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const body = parseBody(req);

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      const url = body.url;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: "URL wajib diisi"
        });
      }

      if (!urls.includes(url)) {
        urls.push(url);
        saveUrls(urls);
      }

      return res.json({
        success: true,
        message: "URL ditambahkan",
        urls
      });
    }

    // ======================
    // DELETE URL
    // ======================
    if (action === "delete-url") {
      const url = body.url;

      urls = urls.filter(x => x !== url);
      saveUrls(urls);

      return res.json({
        success: true,
        message: "URL dihapus",
        urls
      });
    }

    // ======================
    // LIST URL
    // ======================
    if (action === "list-url") {
      return res.json({
        success: true,
        total: urls.length,
        urls
      });
    }

    // ======================
    // SEND MODE
    // ======================
    const subjek = (body.subjek || "").trim();
    const pesan = body.pesan || "";
    const sender = body.sender || "";
    const raw = body.raw === "true"; // 🔥 FIX MODE

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    // ======================
    // VARIABLES
    // ======================
    const vars = {
      subjek,
      sender,
      ip:
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown",
      time: new Date().toISOString()
    };

    let content;

    // ======================
    // FIX DOUBLE ISSUE
    // ======================
    if (raw) {
      // 🔥 RAW HTML MODE (NO WRAPPER)
      content = render(pesan, vars);
    } else {
      // 🔥 TEMPLATE MODE (SAFE)
      content = `
<div style="font-family:Arial;background:#0f172a;color:#fff;padding:20px;border-radius:12px">
  <h1>🚨 SYSTEM ALERT</h1>

  <p><b>User:</b> ${sender}</p>
  <p><b>IP:</b> ${vars.ip}</p>
  <p><b>Time:</b> ${vars.time}</p>

  <hr style="border:1px solid #334155">

  <div style="margin-top:10px;padding:10px;background:#1e293b;border-radius:8px">
    ${render(pesan, vars)}
  </div>
</div>
`;
    }

    const payload = new URLSearchParams({
      subjek: render(subjek, vars),
      pesan: content,
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
      raw,
      total: urls.length,
      vars_used: vars,
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
