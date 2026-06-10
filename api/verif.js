import fs from "fs";

const file = "./license.json";

/* =========================
   AUTO CREATE DB
========================= */
function init() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      active: true,
      apikey: "SITE_KEY",
      redirect: "https://yourdomain.com",
      lock_html: `
        <h1 style="color:#ff3b3b;">LICENSE BLOCKED</h1>
        <p>Access denied</p>
      `
    }, null, 2));
  }
}

function load() {
  init();
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =========================
   MAIN HANDLER
========================= */
export default function handler(req, res) {
  const data = load();

  res.setHeader("Content-Type", "text/html");

  /* ================= API MODE ================= */
  if (req.query.api == "1") {
    const key = req.query.apikey || "";

    // INVALID KEY
    if (key !== data.apikey) {
      return res.json({
        active: false,
        redirect: data.redirect,
        lock_html: data.lock_html
      });
    }

    // VALID KEY
    return res.json({
      active: data.active
    });
  }

  /* ================= ADMIN PANEL ================= */
  if (req.method === "GET") {
    return res.end(`
<!DOCTYPE html>
<html>
<head>
<title>License Panel</title>
<style>
body{
  margin:0;
  font-family:Arial;
  background:#0b0f19;
  color:white;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
}

.box{
  width:400px;
  background:#111827;
  padding:25px;
  border-radius:12px;
}

input, textarea{
  width:100%;
  margin-top:10px;
  padding:10px;
  border-radius:8px;
  border:none;
  background:#0b1220;
  color:white;
}

button{
  margin-top:15px;
  width:100%;
  padding:10px;
  background:#22c55e;
  border:none;
  color:white;
  border-radius:8px;
  cursor:pointer;
}
</style>
</head>
<body>

<div class="box">
<h2>🔐 License Admin</h2>

<form method="POST">

<label>Active</label><br>
<input type="checkbox" name="active" ${data.active ? "checked" : ""}>

<input name="apikey" value="${data.apikey}" placeholder="API KEY">

<input name="redirect" value="${data.redirect}" placeholder="Redirect URL">

<textarea name="lock_html" rows="6">${data.lock_html}</textarea>

<button type="submit">SAVE</button>

</form>

<p>Status:
<b style="color:${data.active ? "lime" : "red"}">
${data.active ? "ACTIVE" : "BLOCKED"}
</b></p>

</div>

</body>
</html>
    `);
  }

  /* ================= SAVE ADMIN ================= */
  if (req.method === "POST") {
    let body = "";

    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const post = Object.fromEntries(new URLSearchParams(body));

      data.active = post.active === "on";
      data.apikey = post.apikey || data.apikey;
      data.redirect = post.redirect || data.redirect;
      data.lock_html = post.lock_html || data.lock_html;

      save(data);

      res.end("✅ SAVED SUCCESS");
    });

    return;
  }

  res.end("License System Running");
}
