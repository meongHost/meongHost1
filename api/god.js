const fs = require("fs");
const path = require("path");

// ======================
// PARSE INPUT → VARIABLES
// ======================
function extractVars(input = "") {
  const text = String(input);
  const vars = {};

  // 1. format key:value (username:John)
  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n<]+)/g;

  let m;
  while ((m = regex.exec(text)) !== null) {
    vars[m[1].toLowerCase()] = m[2].trim();
  }

  // 2. auto email detect
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  if (email) vars.email = email[0];

  // 3. auto phone detect
  const phone = text.match(/(\+?\d{8,15})/);
  if (phone) vars.phone = phone[1];

  return vars;
}

// ======================
// TEMPLATE RENDER ENGINE
// ======================
function renderTemplate(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

// ======================
// CLEAN HTML STRIP (optional)
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// MAIN HANDLER (API)
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    let body = req.body;

    // parse form-data / x-www-form-urlencoded
    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    }

    const message = body.message || "";
    const template = body.template || `
      <html>
        <body>
          <h2>Welcome {{username}}</h2>
          <p>Email: {{email}}</p>
          <p>Phone: {{phone}}</p>
        </body>
      </html>
    `;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message required"
      });
    }

    // ======================
    // EXTRACT VARIABLES
    // ======================
    const vars = extractVars(message);

    // ======================
    // RENDER HTML
    // ======================
    const html = renderTemplate(template, vars);

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
