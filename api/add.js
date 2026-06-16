const https = require("https");

/* =========================
   CONFIG
========================= */
const OWNER = "meongHost";
const REPO = "meongHost1";
const BRANCH = "main";

const TOKEN = "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";
const API_KEY = "joest27";

const URLS_FILE = "data/urls.json";
const EXPIRE_FILE = "data/url_expired.json";

/* =========================
   GITHUB REQUEST
========================= */
function githubRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          "User-Agent": "NodeJS",
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
        }
      },
      res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* =========================
   VALID URL
========================= */
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/* =========================
   LOAD FILE
========================= */
async function loadFile(filePath) {
  const res = await githubRequest(
    "GET",
    `/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`
  );

  if (res.status === 404) {
    return { data: filePath.includes("expired") ? {} : [], sha: null };
  }

  if (res.status !== 200) {
    throw new Error(`GitHub load failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(res.body.content || "", "base64").toString("utf8"));
  } catch {
    data = filePath.includes("expired") ? {} : [];
  }

  return { data, sha: res.body.sha };
}

/* =========================
   SAVE FILE (retry sekali kalau sha conflict)
========================= */
async function saveFile(filePath, contentData, sha, message) {
  const doSave = currentSha =>
    githubRequest("PUT", `/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      message,
      branch: BRANCH,
      sha: currentSha || undefined,
      content: Buffer.from(JSON.stringify(contentData, null, 2)).toString("base64")
    });

  let res = await doSave(sha);

  if (res.status === 409 || res.status === 422) {
    const fresh = await loadFile(filePath);
    res = await doSave(fresh.sha);
  }

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`GitHub save failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return res.body;
}

/* =========================
   CLEAN EXPIRED
========================= */
function cleanExpired(urls, expired, now) {
  let changed = false;

  const alive = urls.filter(url => {
    const exp = expired[url];
    if (!exp) return true;
    if (exp <= now) {
      delete expired[url];
      changed = true;
      return false;
    }
    return true;
  });

  return { alive, changed };
}

/* =========================
   MAIN HANDLER
========================= */
module.exports = async (req, res) => {
  try {
    const [urlFile, expFile] = await Promise.all([
      loadFile(URLS_FILE),
      loadFile(EXPIRE_FILE)
    ]);

    let urls = Array.isArray(urlFile.data) ? urlFile.data : [];
    let expired = typeof expFile.data === "object" && expFile.data ? expFile.data : {};

    const now = Math.floor(Date.now() / 1000);

    const cleaned = cleanExpired(urls, expired, now);
    urls = cleaned.alive;

    if (cleaned.changed) {
      await Promise.all([
        saveFile(URLS_FILE, urls, urlFile.sha, "Auto remove expired URLs"),
        saveFile(EXPIRE_FILE, expired, expFile.sha, "Auto remove expired metadata")
      ]);
    }

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        total: urls.length,
        urls: urls.map(url => ({
          url,
          days_left: Math.max(0, Math.ceil(((expired[url] || now) - now) / 86400))
        }))
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    const apikey = body.apikey || "";
    const url = String(body.url || "").trim();
    const days = Number(body.days || 30);

    if (apikey !== API_KEY) {
      return res.status(403).json({ success: false, message: "apikey salah" });
    }
    if (!url) {
      return res.status(400).json({ success: false, message: "url kosong" });
    }
    if (!isValidUrl(url)) {
      return res.status(400).json({ success: false, message: "url tidak valid" });
    }
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return res.status(400).json({ success: false, message: "days harus 1-365" });
    }
    if (urls.some(x => x.toLowerCase() === url.toLowerCase())) {
      return res.status(200).json({ success: false, message: "url sudah ada" });
    }

    urls.push(url);
    expired[url] = now + days * 86400;

    const [latestUrls, latestExp] = await Promise.all([
      loadFile(URLS_FILE),
      loadFile(EXPIRE_FILE)
    ]);

    latestUrls.data = Array.isArray(latestUrls.data) ? latestUrls.data : [];
    if (!latestUrls.data.some(x => x.toLowerCase() === url.toLowerCase())) {
      latestUrls.data.push(url);
    }
    latestExp.data = typeof latestExp.data === "object" && latestExp.data ? latestExp.data : {};
    latestExp.data[url] = now + days * 86400;

    const saveUrls = await saveFile(URLS_FILE, latestUrls.data, latestUrls.sha, `Add URL ${url}`);
    const saveExpire = await saveFile(EXPIRE_FILE, latestExp.data, latestExp.sha, `Add Expire ${url}`);

    return res.status(200).json({
      success: true,
      message: "url berhasil ditambahkan",
      total: latestUrls.data.length,
      commit: saveUrls.commit?.sha || null,
      data: {
        url,
        days,
        expired_at: latestExp.data[url]
      }
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ success: false, error: err.message || "Unknown error" });
  }
};
