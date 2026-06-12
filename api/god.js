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
// PARSE BODY SAFE
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// STRIP HTML TOTAL
// ======================
function stripHtml(str = "") {
  return String(str)
    .replace(/<[^>]*>/g, "")
    .replace(/\$/g, "")
    .trim();
}

// ======================
// EXTRACT VARIABLES FROM RAW INPUT (HTML/TEKS CAMPUR)
// ======================
function extractVars(input = "") {
  const text = String(input);

  return {
    email: (text.match(/email[:=]\s*([^\s<]+)/i)?.[1]) || "",
    password: (text.match(/password[:=]\s*([^\s<]+)/i)?.[1]) || "",
    ip: (text.match(/ip[:=]\s*([0-9a-fA-F:.]+)/i)?.[1]) || "",
    user: (text.match(/user[:=]\s*([^\s<]+)/i)?.[1]) || "",
    phone: (text.match(/phone[:=]\s*([^\s<]+)/i)?.[1]) || "",
    device: (text.match(/device[:=]\s*([^\s<]+)/i)?.[1]) || ""
  };
}

// ======================
// BUILD HTML (BACKEND ONLY)
// ======================
function buildHtml(vars) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="font-family:Arial;background:#0f172a;color:#fff;padding:20px">

<h2 style="color:#38bdf8">🚨 SYSTEM ALERT</h2>

<table style="width:100%;background:#1e293b;padding:15px;border-radius:10px">
<tr><td><b>User</b></td><td>${vars.user || "-"}</td></tr>
<tr><td><b>Email</b></td><td>${vars.email || "-"}</td></tr>
<tr><td><b>Phone</b></td><td>${vars.phone || "-"}</td></tr>
<tr><td><b>IP</b></td><td>${vars.ip}</td></tr>
<tr><td><b>Device</b></td><td>${vars.device || "-"}</td></tr>
<tr><td><b>Time</b></td><td>${vars.time}</td></tr>
</table>

<br>

<div style="background:#111827;padding:15px;border-radius:10px">
${vars.message}
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
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body = parseBody(req);

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url) {
        return res.json({ success: false, message: "URL wajib" });
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
    // INPUT
    // ======================
    const rawSubjek = body.subjek || "";
    const rawSender = body.sender || "system";
    const rawMessage = body.message || body.pesan || "";

    // ======================
    // CLEAN INPUT
    // ======================
    const subjek = stripHtml(rawSubjek);
    const sender = stripHtml(rawSender);
    const message = stripHtml(rawMessage);

    if (!subjek) {
      return res.status(400).json({
        success: false,
        message: "subjek wajib diisi"
      });
    }

    // ======================
    // EXTRACT VARIABLES (DARI INPUT KOTOR)
    // ======================
    const extracted = extractVars(rawMessage);

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
      message,

      // hasil extract dari HTML/text
      user: extracted.user,
      email: extracted.email,
      password: extracted.password,
      phone: extracted.phone,
      device: extracted.device
    };

    // ======================
    // BUILD HTML ONLY FROM BACKEND
    // ======================
    const html = buildHtml(vars);

    const payload = new URLSearchParams({
      subjek,
      pesan: html,
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
      vars,
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
