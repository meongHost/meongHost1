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
// SIMPLE TEMPLATE ENGINE ($var)
// ======================
function renderTemplate(str, vars = {}) {
  return String(str).replace(/\$(\w+)/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const body = parseBody(req);
    const action = body.action || "send";

    let urls = loadUrls();

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
    // SEND MODE + TEMPLATE ENGINE
    // ======================
    const subjek = (body.subjek || "").trim();
    const pesan = body.pesan || "";
    const pesan_html = body.pesan_html || "";
    const sender = body.sender || "";

    if (!subjek || (!pesan && !pesan_html)) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    // ======================
    // VARIABLES (UNTUK $var)
    // ======================
    const vars = {
      subjek,
      pesan,
      sender,
      ip: req.headers["x-forwarded-for"] || "unknown",
      time: new Date().toISOString()
    };

    // render template HTML / TEXT
    const finalMessage = renderTemplate(pesan_html || pesan, vars);

    const isHtml = Boolean(pesan_html);

    const payload = new URLSearchParams({
      subjek: renderTemplate(subjek, vars),
      pesan: finalMessage,
      sender,
      is_html: isHtml
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
      html: isHtml,
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
