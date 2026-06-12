module.exports = async (req, res) => {
  try {
    // ======================
    // METHOD CHECK
    // ======================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    // ======================
    // PARSE BODY
    // ======================
    let body = req.body;

    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    }

    const message = body.message || "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message wajib diisi"
      });
    }

    // ======================
    // AUTO DETECT VARIABLES
    // ======================
    const extractVars = (input = "") => {
      const text = String(input);
      const vars = {};

      // key:value parsing
      const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n<]+)/g;
      let m;

      while ((m = regex.exec(text)) !== null) {
        vars[m[1].toLowerCase()] = m[2].trim();
      }

      // auto email detect
      const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
      if (email) vars.email = email[0];

      // auto phone detect
      const phone = text.match(/(\+?\d{8,15})/);
      if (phone) vars.phone = phone[1];

      return vars;
    };

    // ======================
    // BUILD HTML AUTO
    // ======================
    const buildHtml = (vars) => {
      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>System Report</title>
</head>

<body style="margin:0;font-family:Arial;background:#0f172a;color:#e5e7eb;padding:20px">

  <div style="max-width:650px;margin:auto;background:#111827;border-radius:10px;overflow:hidden">

    <div style="padding:18px;background:#0b1220;text-align:center;border-bottom:1px solid #1f2937">
      <h2 style="margin:0;font-size:18px">System Report</h2>
      <small style="color:#94a3b8">Auto Generated Data</small>
    </div>

    <div style="padding:20px">

      <table style="width:100%;border-collapse:collapse">
`;

      for (const key in vars) {
        html += `
        <tr>
          <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8;font-size:13px">
            ${key}
          </td>
          <td style="padding:10px;border:1px solid #1f2937;background:#111827;font-size:13px">
            ${vars[key]}
          </td>
        </tr>
        `;
      }

      html += `
      </table>

    </div>

  </div>

</body>
</html>
`;

      return html;
    };

    // ======================
    // PROCESS DATA
    // ======================
    const vars = extractVars(message);

    // auto IP
    vars.ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    const html = buildHtml(vars);

    // ======================
    // RESPONSE
    // ======================
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
