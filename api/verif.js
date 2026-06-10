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
        <div style="text-align:center;font-family:Arial">
          <h1 style="color:#ff3b3b">LICENSE BLOCKED</h1>
          <p>Access denied</p>
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

/* ================= MAIN HANDLER ================= */
export default function handler(req, res) {
  const data = load();

  /* ===== API MODE ===== */
  if (req.url.includes("api=1")) {
    const key = req.query.apikey || "";

    if (key !== data.apikey) {
      return res.json({
        active: false,
        redirect: data.redirect,
        lock_html: data.lock_html
      });
    }

    return res.json({
      active: data.active
    });
  }

  /* ===== SAVE ADMIN ===== */
  if (req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);
    req.on("end", () => {
      const post = Object.fromEntries(new URLSearchParams(body));

      data.active = post.active === "on";
      data.apikey = post.apikey || data.apikey;
      data.redirect = post.redirect || data.redirect;
      data.lock_html = post.lock_html || data.lock_html;

      save(data);

      res.end("OK");
    });

    return;
  }

  /* ===== ADMIN PANEL ===== */
  res.setHeader("Content-Type", "text/html");
  res.end(`
  <html>
  <body style="background:#0b0f19;color:white;font-family:Arial">
    <div style="max-width:400px;margin:100px auto;background:#111827;padding:20px;border-radius:10px">
      <h2>License Panel</h2>

      <form method="POST">
        <label>
          <input type="checkbox" name="active" ${data.active ? "checked" : ""}>
          Active
        </label>

        <input name="apikey" value="${data.apikey}" style="width:100%;margin-top:10px;padding:8px">
        <input name="redirect" value="${data.redirect}" style="width:100%;margin-top:10px;padding:8px">

        <textarea name="lock_html" style="width:100%;margin-top:10px;padding:8px">${data.lock_html}</textarea>

        <button style="width:100%;margin-top:10px;padding:10px">SAVE</button>
      </form>

      <p>Status: ${data.active ? "ACTIVE" : "BLOCKED"}</p>
    </div>
  </body>
  </html>
  `);
}
