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

    const message = body.message || body.pesan || "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message wajib diisi"
      });
    }

    // ======================
    // CLEAN HTML / TEXT
    // ======================
    const cleanText = (text) => {
      return String(text)
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/\r/g, "");
    };

    // ======================
    // AUTO DETECT VARIABLES
    // ======================
    const extractVars = (input) => {
      const text = cleanText(input);
      const vars = {};

      const lines = text.split("\n");

      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_]+)\s*[:=]\s*(.+)$/i);
        if (match) {
          const key = match[1].toLowerCase().trim();
          const value = match[2].trim();
          vars[key] = value;
        }
      }

      // auto email
      const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
      if (email) vars.email = email[0];

      // auto phone
      const phone = text.match(/\b\d{8,15}\b/);
      if (phone) vars.phone = phone[0];

      return vars;
    };

    // ======================
    // ANTI SPAM (IP COOLDOWN 3 DETIK)
    // ======================
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    if (!global.spam) global.spam = {};

    const now = Date.now();

    if (global.spam[ip] && now - global.spam[ip] < 3000) {
      return res.status(429).json({
        success: false,
        message: "Too fast (anti spam 3 detik)"
      });
    }

    global.spam[ip] = now;

    // ======================
    // PROCESS VARS
    // ======================
    const vars = extractVars(message);
    vars.ip = ip;

    // ======================
    // BUILD HTML REPORT
    // ======================
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>System Report</title>
</head>

<body style="margin:0;background:#0f172a;font-family:Arial;color:#e5e7eb;padding:20px">

<div style="max-width:700px;margin:auto;background:#111827;border-radius:10px;overflow:hidden">

  <div style="padding:18px;background:#0b1220;text-align:center;border-bottom:1px solid #1f2937">
    <h2 style="margin:0">System Report</h2>
    <small style="color:#94a3b8">Auto Generated System</small>
  </div>

  <div style="padding:20px">

    <table style="width:100%;border-collapse:collapse">

      ${Object.entries(vars)
        .map(
          ([k, v]) => `
        <tr>
          <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8;font-size:13px">
            ${k}
          </td>
          <td style="padding:10px;border:1px solid #1f2937;background:#111827;font-size:13px">
            ${v}
          </td>
        </tr>
      `
        )
        .join("")}

    </table>

  </div>

</div>

</body>
</html>
`;

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
