import { nanoid } from "nanoid";

// IN-MEMORY STORAGE (HANYA SEMENTARA)
const store = globalThis.store || (globalThis.store = {});

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // =========================
  // 1. CREATE SHORTLINK
  // =========================
  if (path === "/api/create") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    let body = "";

    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body || "{}");

    if (!data.url) {
      return res.status(400).json({ error: "URL required" });
    }

    const slug = nanoid(6);
    store[slug] = data.url;

    return res.status(200).json({
      success: true,
      short: `https://${req.headers.host}/${slug}`,
      slug
    });
  }

  // =========================
  // 2. REDIRECT SHORTLINK
  // =========================
  const slug = path.replace("/", "");

  if (slug && store[slug]) {
    return res.writeHead(302, { Location: store[slug] }).end();
  }

  // =========================
  // 3. HOME
  // =========================
  res.setHeader("Content-Type", "text/html");
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Shortlink</title>
</head>
<body style="font-family:Arial;text-align:center;margin-top:50px">

<h2>Shortlink Generator</h2>

<input id="url" placeholder="Masukkan URL" style="padding:10px;width:300px"/>
<br><br>
<button onclick="make()">Short</button>

<p id="result"></p>

<script>
async function make() {
  const url = document.getElementById("url").value;

  const res = await fetch("/api/create", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ url })
  });

  const data = await res.json();

  document.getElementById("result").innerText =
    data.short || data.error;
}
</script>

</body>
</html>
  `);
}
