const https = require("https");

const OWNER = "meongHost";
const REPO = "meongHost1";
const BRANCH = "main";

const TOKEN = "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";
const API_KEY = "joest27";

const FILE_PATH = "data/urls.json";

function githubRequest(method, path, body = null) {
return new Promise((resolve, reject) => {
const req = https.request(
{
hostname: "api.github.com",
path,
method,
headers: {
"User-Agent": "NodeJS",
Authorization: "Bearer ${TOKEN}",
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

async function getUrlsFile() {
const file = await githubRequest(
"GET",
"/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}"
);

let urls = [];

if (file.content) {
try {
urls = JSON.parse(
Buffer.from(
file.content,
"base64"
).toString("utf8")
);
} catch {
urls = [];
}
}

if (!Array.isArray(urls)) {
urls = [];
}

return {
urls,
sha: file.sha
};
}

async function saveUrls(urls, sha, message) {
const content = Buffer.from(
JSON.stringify(urls, null, 2)
).toString("base64");

return githubRequest(
"PUT",
"/repos/${OWNER}/${REPO}/contents/${FILE_PATH}",
{
message,
content,
sha,
branch: BRANCH
}
);
}

module.exports = async (req, res) => {
try {
const { urls, sha } =
await getUrlsFile();

const now = Math.floor(
  Date.now() / 1000
);

const activeUrls = urls.filter(
  item =>
    item.expired_at > now
);

if (
  activeUrls.length !== urls.length
) {
  await saveUrls(
    activeUrls,
    sha,
    "Auto remove expired URLs"
  );
}

if (req.method === "GET") {
  return res.json({
    success: true,
    total: activeUrls.length,
    urls: activeUrls.map(
      item => ({
        url: item.url,
        created_at:
          item.created_at,
        expired_at:
          item.expired_at,
        days_left: Math.ceil(
          (item.expired_at -
            now) /
            86400
        )
      })
    )
  });
}

if (req.method !== "POST") {
  return res.status(405).json({
    success: false,
    message: "POST only"
  });
}

const body = req.body || {};

const apikey =
  body.apikey || "";

const url =
  String(
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

const exists =
  activeUrls.find(
    item =>
      item.url.toLowerCase() ===
      url.toLowerCase()
  );

if (exists) {
  return res.json({
    success: false,
    message:
      "url sudah ada"
  });
}

activeUrls.push({
  url,
  created_at: now,
  expired_at:
    now +
    days * 86400
});

const latest =
  await getUrlsFile();

const update =
  await saveUrls(
    activeUrls,
    latest.sha,
    `Add URL ${url}`
  );

return res.json({
  success: true,
  message:
    "url berhasil ditambahkan",
  total:
    activeUrls.length,
  commit:
    update.commit?.sha ||
    null,
  data: {
    url,
    days,
    expired_at:
      now +
      days * 86400
  }
});

} catch (err) {
return res.status(500).json({
success: false,
error: err.message
});
}
};
