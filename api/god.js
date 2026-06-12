const fs = require("fs");

// ======================
// 1. EXTRACT VARIABLES
// ======================
function extractVars(input = "") {
  const text = String(input);
  const vars = {};

  // format: email:test@mail.com
  const regex1 = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n<]+)/g;

  let m;
  while ((m = regex1.exec(text)) !== null) {
    vars[m[1].toLowerCase()] = m[2].trim();
  }

  // detect PHP style $variable (tanpa value)
  const regex2 = /\$([a-zA-Z0-9_]+)/g;

  let match;
  while ((match = regex2.exec(text)) !== null) {
    const key = match[1];
    if (!vars[key]) vars[key] = "";
  }

  return vars;
}

// ======================
// 2. RENDER PHP STYLE TEMPLATE
// ======================
function renderPhpTemplate(html, vars) {
  return html.replace(/\$([a-zA-Z0-9_]+)/g, (full, key) => {
    return vars[key] ?? "";
  });
}

// ======================
// 3. STRIP OPTIONAL HTML TAG (SAFE INPUT)
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

// ======================
// 4. MAIN API HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    let body = req.body;

    // support form-urlencoded
    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    }

    const message = body.message || "";
    const template = body.template || `
      <html>
        <body>
          <h2>INFO LOGIN</h2>
          <p>Email: $email</p>
          <p>Password: $password</p>
          <p>Login: $login</p>
          <p>IP: $ip</p>
        </body>
      </html>
    `;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message wajib diisi"
      });
    }

    // ======================
    // AUTO DETECT VARS
    // ======================
    const vars = extractVars(stripHtml(message));

    // auto IP fallback
    vars.ip =
      vars.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    // ======================
    // RENDER TEMPLATE
    // ======================
    const html = renderPhpTemplate(template, vars);

    return res.json({
      success: true,
      vars,
      html
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
