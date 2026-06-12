module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    let body = req.body;

    // ======================
    // PARSE FORM DATA
    // ======================
    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    }

    const message = body.message || "";
    const template = body.template || `
      <div>
        <h3>System Report</h3>
        <p>Email: $email</p>
        <p>Password: $password</p>
        <p>Login: $login</p>
        <p>IP: $ip</p>
      </div>
    `;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message wajib diisi"
      });
    }

    // ======================
    // SIMPLE ANTI-SPAM (PER REQUEST LOCK)
    // ======================
    if (req._handled) {
      return res.status(429).json({
        success: false,
        message: "duplicate request blocked"
      });
    }
    req._handled = true;

    // ======================
    // EXTRACT VARIABLES (PHP STYLE + KEY:VALUE)
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

      // detect $variable existence
      const regex2 = /\$([a-zA-Z0-9_]+)/g;
      let match;

      while ((match = regex2.exec(text)) !== null) {
        const key = match[1];
        if (!vars[key]) vars[key] = "";
      }

      return vars;
    }

    // ======================
    // RENDER TEMPLATE ($variable)
    // ======================
    function renderPhpTemplate(html, vars) {
      return html.replace(/\$([a-zA-Z0-9_]+)/g, (full, key) => {
        return vars[key] ?? "";
      });
    }

    // ======================
    // AUTO DETECT VARS
    // ======================
    const vars = extractVars(message);

    // IP fallback
    vars.ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    // ======================
    // RENDER HTML
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
