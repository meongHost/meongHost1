const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// load JSON
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

// save JSON
function saveUrls(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const body =
      typeof req.body === "string"
        ? Object.fromEntries(new URLSearchParams(req.body))
        : req.body || {};

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
    // SEND MODE
    // ======================
    const subjek = (body.subjek || "").trim();
    const pesan = (body.pesan || "").trim();
    const sender = body.sender || "";

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    const payload = new URLSearchParams({
      subjek,
      pesan,
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
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
