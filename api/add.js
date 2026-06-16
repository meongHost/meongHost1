const https = require("https");

const OWNER = meongHost";
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

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/* =========================
   VALID URL
========================= */
function isValidUrl(url) {
  try {
    const u = new URL(url);

    return (
      (u.protocol === "http:" ||
        u.protocol === "https:") &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

/* =========================
   LOAD FILE
========================= */
async function loadFile(pathFile) {
  const file = await githubRequest(
    "GET",
    `/repos/${OWNER}/${REPO}/contents/${pathFile}?ref=${BRANCH}`
  );

  let data;

  try {
    data = JSON.parse(
      Buffer.from(
        file.content || "",
        "base64"
      ).toString("utf8")
    );
  } catch {
    data = pathFile.includes("expired")
      ? {}
      : [];
  }

  return {
    data,
    sha: file.sha
  };
}

/* =========================
   SAVE FILE
========================= */
async function saveFile(
  pathFile,
  contentData,
  sha,
  message
) {
  return githubRequest(
    "PUT",
    `/repos/${OWNER}/${REPO}/contents/${pathFile}`,
    {
      message,
      branch: BRANCH,
      sha,
      content: Buffer.from(
        JSON.stringify(
          contentData,
          null,
          2
        )
      ).toString("base64")
    }
  );
}

/* =========================
   MAIN
========================= */
module.exports = async (req, res) => {
  try {

    const urlFile =
      await loadFile(URLS_FILE);

    const expFile =
      await loadFile(EXPIRE_FILE);

    let urls = Array.isArray(
      urlFile.data
    )
      ? urlFile.data
      : [];

    let expired =
      typeof expFile.data ===
        "object" &&
      expFile.data
        ? expFile.data
        : {};

    const now = Math.floor(
      Date.now() / 1000
    );

    /* =========================
       AUTO REMOVE EXPIRED
    ========================= */
    const before = urls.length;

    urls = urls.filter(url => {
      const exp = expired[url];

      if (!exp) return true;

      if (exp <= now) {
        delete expired[url];
        return false;
      }

      return true;
    });

    if (before !== urls.length) {

      const latestUrls =
        await loadFile(URLS_FILE);

      const latestExp =
        await loadFile(EXPIRE_FILE);

      await saveFile(
        URLS_FILE,
        urls,
        latestUrls.sha,
        "Auto remove expired URLs"
      );

      await saveFile(
        EXPIRE_FILE,
        expired,
        latestExp.sha,
        "Auto remove expired metadata"
      );
    }

    /* =========================
       GET LIST
    ========================= */
    if (req.method === "GET") {

      return res.json({
        success: true,
        total: urls.length,
        urls: urls.map(url => ({
          url,
          days_left: Math.max(
            0,
            Math.ceil(
              ((expired[url] || now) -
                now) /
                86400
            )
          )
        }))
      });
    }

    /* =========================
       POST ONLY
    ========================= */
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body = req.body || {};

    const apikey =
      body.apikey || "";

    const url = String(
      body.url || ""
    ).trim();

    const days = Number(
      body.days || 30
    );

    if (apikey !== API_KEY) {
      return res.status(403).json({
        success: false,
        message: "apikey salah"
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "url kosong"
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message:
          "url tidak valid"
      });
    }

    if (
      days < 1 ||
      days > 365
    ) {
      return res.status(400).json({
        success: false,
        message:
          "days harus 1-365"
      });
    }

    if (
      urls.some(
        x =>
          x.toLowerCase() ===
          url.toLowerCase()
      )
    ) {
      return res.json({
        success: false,
        message:
          "url sudah ada"
      });
    }

    urls.push(url);

    expired[url] =
      now + days * 86400;

    const latestUrls =
      await loadFile(URLS_FILE);

    const latestExp =
      await loadFile(EXPIRE_FILE);

    await saveFile(
      URLS_FILE,
      urls,
      latestUrls.sha,
      `Add URL ${url}`
    );

    await saveFile(
      EXPIRE_FILE,
      expired,
      latestExp.sha,
      `Add Expire ${url}`
    );

    return res.json({
      success: true,
      message:
        "url berhasil ditambahkan",
      total: urls.length,
      data: {
        url,
        days,
        expired_at:
          expired[url]
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
