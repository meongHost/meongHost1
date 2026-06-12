module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false });
    }

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
    // CLEAN TEXT
    // ======================
    const clean = (t) =>
      String(t)
        .replace(/<[^>]*>/g, " ")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // ======================
    // FIXED AUTO PARSER (INI KUNCI)
    // ======================
    const extractVars = (input) => {
      const text = clean(input);
      const vars = {};

      // 🔥 FIX: split by space THEN parse key:value
      const parts = text.split(" ");

      for (const part of parts) {
        const match = part.match(/^([a-zA-Z0-9_]+):(.+)$/);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2];
          vars[key] = value;
        }
      }

      // fallback email
      const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
      if (email) vars.email = email[0];

      // fallback phone
      const phone = text.match(/\b\d{8,15}\b/);
      if (phone) vars.phone = phone[0];

      return vars;
    };

    // ======================
    // PROCESS
    // ======================
    const vars = extractVars(message);

    vars.ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "";

    // ======================
    // HTML GENERATOR
    // ======================
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial;background:#0f172a;color:#fff;padding:20px">

<h2>System Report</h2>

<table border="1" style="border-collapse:collapse;width:100%">
${Object.entries(vars)
  .map(
    ([k, v]) => `
<tr>
<td style="padding:8px;background:#1f2937">${k}</td>
<td style="padding:8px">${v}</td>
</tr>`
  )
  .join("")}
</table>

</body>
</html>
`;

    return res.json({
      success: true,
      vars,
      html
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
};
