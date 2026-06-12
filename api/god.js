const rateLimitMap = new Map();

// ======================
// CONFIG
// ======================
const allowed = [
  "user",
  "email",
  "password",
  "login",
  "phone",
  "ip",
  "device",
  "browser",
  "platform"
];

// ======================
// RATE LIMIT (ANTI SPAM)
// ======================
function rateLimit(ip) {
  const now = Date.now();
  const limit = 5; // 5 request
  const windowMs = 60 * 1000; // 1 menit

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);

  if (timestamps.length >= limit) return false;

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

// ======================
// PARSE BODY
// ======================
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body;
}

// ======================
// STRIP HTML
// ======================
function stripHtml(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// AUTO DETECT VARS
// ======================
function extractVars(input = "") {
  const text = stripHtml(input);
  const vars = {};

  // ambil format key:value
  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n]+)/g;

  let m;
  while ((m = regex.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();

    if (allowed.includes(key) && value) {
      vars[key] = value;
    }
  }

  return vars;
}

// ======================
// BUILD HTML TEMPLATE
// ======================
function buildHtml(vars, subjek) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${subjek}</title>
</head>

<body style="margin:0;background:#0f172a;font-family:Arial;color:#e5e7eb;padding:20px">

  <div style="max-width:700px;margin:auto;background:#111827;border-radius:12px;overflow:hidden">

    <div style="padding:18px;background:#0b1220;text-align:center;border-bottom:1px solid #1f2937">
      <h2 style="margin:0;color:#fff">${subjek}</h2>
      <small style="color:#94a3b8">Auto Generated Report</small>
    </div>

    <div style="padding:20px">

      <table style="width:100%;border-collapse:collapse">

        ${Object.entries(vars)
          .map(
            ([k, v]) => `
          <tr>
            <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8">
              ${k}
            </td>
            <td style="padding:10px;border:1px solid #1f2937;background:#111827">
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
}

// ======================
// MAIN API
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "POST only" });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    // ======================
    // ANTI SPAM CHECK
    // ======================
    if (!rateLimit(ip)) {
      return res.status(429).json({
        success: false,
        message: "Too many requests (anti spam)"
      });
    }

    const body = parseBody(req);

    // ======================
    // VALIDASI WAJIB
    // ======================
    if (!body.subjek || !body.pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek dan pesan wajib diisi"
      });
    }

    // ======================
    // AUTO DETECT VARS
    // ======================
    const vars = extractVars(body.pesan);

    // inject ip otomatis
    vars.ip = ip;

    // ======================
    // BUILD HTML
    // ======================
    const html = buildHtml(vars, body.subjek);

    return res.json({
      success: true,
      subjek: body.subjek,
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
