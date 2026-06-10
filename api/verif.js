import fs from "fs";

const file = "./license.json";

/* ================= INIT DB ================= */
function init() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      active: true,
      apikey: "SITE_KEY",
      redirect: "https://yourdomain.com",
      lock_html: `
        <div style="text-align:center;font-family:Arial;color:white">
          <h1 style="color:#ff3b3b">LICENSE BLOCKED</h1>
          <p>Access denied by server</p>
        </div>
      `
    }, null, 2));
  }
}

function load() {
  init();
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ================= HANDLER ================= */
export default async function handler(req, res) {
  const data = load();

  /* ================= API MODE ================= */
  if (req.query.api === "1") {
    const key = req.query.apikey || "";

    if (key !== data.apikey || !data.active) {
      return res.status(200).json({
        active: false,
        redirect: data.redirect,
        lock_html: data.lock_html
      });
    }

    return res.status(200).json({
      active: true
    });
  }

  /* ================= ADMIN PANEL ================= */
  if (req.method === "GET") {
    return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
<title>License Admin</title>
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
  width:420px;
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
<h2>🔐 License Admin Panel</h2>

<form method="POST">
<label>
<input type="checkbox" name="active" ${data.active ? "checked" : ""}>
 Active
</label>

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

  /* ================= SAVE (FIXED SAFE PARSE) ================= */
  if (req.method === "POST") {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString();
    const post = Object.fromEntries(new URLSearchParams(body));

    data.active = post.active === "on";
    data.apikey = post.apikey || data.apikey;
    data.redirect = post.redirect || data.redirect;
    data.lock_html = post.lock_html || data.lock_html;

    save(data);

    return res.status(200).send("✅ SAVED SUCCESS");
  }

  return res.status(200).send("License System Running");
}
