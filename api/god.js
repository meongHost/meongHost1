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
// BODY PARSER SAFE
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
  return String(str).replace(/\$(\w+)/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `$${k}`
  );
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
    const pesan_html = body.pesan_html || "";
    const sender = body.sender || "";

    if (!subjek || (!pesan && !pesan_html)) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan/pesan_html wajib diisi"
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

    // ======================
    // FIX UTAMA: pesan_html → pesan
    // ======================
    let content = pesan_html || pesan;

    // render $variables
    content = render(content, vars);
    const finalSubject = render(subjek, vars);

    const payload = new URLSearchParams({
      subjek: finalSubject,
      pesan: content,   // ✔ FIX HERE
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
      html: Boolean(pesan_html),
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
