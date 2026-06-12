const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "data", "urls.json");

// helper load
function loadUrls() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

// helper save
function saveUrls(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// forward ke semua URL (mirip curl PHP kamu)
async function forwardAll(dataObj) {
  const fetchFn = global.fetch || require("node-fetch");
  const urls = loadUrls();

  const results = [];

  for (const url of urls) {
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams(dataObj).toString()
      });

      results.push({
        url,
        status: res.status,
        success: res.ok
      });
    } catch (err) {
      results.push({
        url,
        success: false,
        error: err.message
      });
    }
  }

  return results;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const action = req.body?.action || "send";

    // =========================
    // ADD URL
    // =========================
    if (action === "add-url") {
      const url = req.body?.url;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: "URL wajib diisi"
        });
      }

      const urls = loadUrls();

      if (urls.includes(url)) {
        return res.status(409).json({
          success: false,
          message: "URL sudah ada"
        });
      }

      urls.push(url);
      saveUrls(urls);

      return res.json({
        success: true,
        message: "URL ditambahkan",
        urls
      });
    }

    // =========================
    // DELETE URL
    // =========================
    if (action === "delete-url") {
      const url = req.body?.url;

      let urls = loadUrls();
      urls = urls.filter(x => x !== url);

      saveUrls(urls);

      return res.json({
        success: true,
        message: "URL dihapus",
        urls
      });
    }

    // =========================
    // LIST URL
    // =========================
    if (action === "list-url") {
      const urls = loadUrls();

      return res.json({
        success: true,
        total: urls.length,
        urls
      });
    }

    // =========================
    // SEND MODE (mirip PHP kamu)
    // =========================
    const subjek = String(req.body?.subjek || "").trim();
    const pesan = String(req.body?.pesan || "").trim();
    const sender = String(req.body?.sender || "").trim();

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek dan pesan wajib diisi"
      });
    }

    const payload = {
      subjek,
      pesan,
      sender
    };

    const result = await forwardAll(payload);

    return res.status(200).json({
      success: true,
      message: "Data dikirim ke semua URL",
      result
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
