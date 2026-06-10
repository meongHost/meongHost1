import fs from "fs";

const file = "/tmp/license.json"; // ✅ FIX: pakai /tmp biar aman di Vercel

function init() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      active: true,
      apikey: "SITE_KEY",
      redirect: "https://yourdomain.com",
      lock_html: `<h1>LICENSE BLOCKED</h1>`
    }));
  }
}

function load() {
  init();
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export default async function handler(req, res) {
  const data = load();

  // ================= API =================
  if (req.query.api == "1") {
    const key = req.query.apikey || "";

    if (key !== data.apikey) {
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

  // ================= ADMIN GET =================
  if (req.method === "GET") {
    return res.status(200).send(`
      <html>
      <body style="background:#0b0f19;color:white;font-family:Arial;padding:40px">
        <h2>License Panel</h2>

        <form method="POST">
          <label>Active</label><br>
          <input type="checkbox" name="active" ${data.active ? "checked" : ""}><br><br>

          <input name="apikey" value="${data.apikey}" style="width:300px"><br><br>
          <input name="redirect" value="${data.redirect}" style="width:300px"><br><br>

          <textarea name="lock_html" rows="6" style="width:300px">${data.lock_html}</textarea><br><br>

          <button type="submit">SAVE</button>
        </form>

        <p>Status: ${data.active ? "ACTIVE" : "BLOCKED"}</p>
      </body>
      </html>
    `);
  }

  // ================= ADMIN POST (FIXED) =================
  if (req.method === "POST") {
    try {
      const buffers = [];

      for await (const chunk of req) {
        buffers.push(chunk);
      }

      const body = Buffer.concat(buffers).toString();
      const post = Object.fromEntries(new URLSearchParams(body));

      data.active = post.active === "on";
      data.apikey = post.apikey || data.apikey;
      data.redirect = post.redirect || data.redirect;
      data.lock_html = post.lock_html || data.lock_html;

      save(data);

      return res.end("SAVED OK");
    } catch (e) {
      return res.status(500).end("ERROR POST");
    }
  }

  return res.end("OK");
}
