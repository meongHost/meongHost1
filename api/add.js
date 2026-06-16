const https = require("https");

/* =========================
   CONFIG
========================= */
const OWNER = process.env.GH_OWNER || "meongHost";
const REPO = process.env.GH_REPO || "meongHost1";
const BRANCH = process.env.GH_BRANCH || "main";
const TOKEN = process.env.GH_TOKEN;
const API_KEY = process.env.API_KEY;

const URLS_FILE = "data/urls.json";
const EXPIRE_FILE = "data/url_expired.json";

/* =========================
   GITHUB REQUEST (with retry on conflict)
========================= */
function githubRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          "User-Agent": "NodeJS",
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        }
      },
      res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
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
   SAVE FILE (auto-retry once on SHA conflict)
========================= */
async function saveFile(filePath, contentData, sha, message) {
  const doSave = sha =>
    githubRequest("PUT", `/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      message,
      branch: BRANCH,
      sha: sha || undefined,
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
   CLEAN EXPIRED URLS
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
   MAIN
========================= */
module.exports = async (req, res) => {
  if (!TOKEN || !API_KEY) {
    return res.status(500).json({ success: false, message: "Server misconfigured: missing TOKEN/API_KEY" });
  }

  try {
    const [urlFile, expFile] = await Promise.all([loadFile(URLS_FILE), loadFile(EXPI
