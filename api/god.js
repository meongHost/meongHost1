const rateLimitMap = new Map();

// ======================
// ALLOWED VARS
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
  "platform",
  "city",
  "isp"
];

// ======================
// ANTI SPAM
// ======================
function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 5;

  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);

  let logs = rateLimitMap.get(ip).filter(t => now - t < windowMs);

  if (logs.length >= limit) return false;

  logs.push(now);
  rateLimitMap.set(ip, logs);
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
// CLEAN INPUT (REMOVE HTML TOTAL)
// ======================
function stripAll(input = "") {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "\n");
}

// ======================
// AUTO DETECT VARS
// ======================
function extractVars(input = "") {
  const text = stripAll(input);
  const vars = {};

  const regex = /([a-zA-Z0-9_]+)\s*[:=]\s*([^\n]+)/g;

  let m;
  while ((m = regex.exec(text)) !== null) {
    const key = m[1].toLowerCase().trim();
    const value = m[2].trim();

    if (allowed.includes(key)) {
      vars[key] = value;
    }
  }

  return vars;
}

// ======================
// TEMPLATE HTML (FULL CONTROL)
// ======================
function buildTemplate(vars, subjek) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${subjek}</title>
</head>

<body style="margin:0;background:#0f172a;font-family:Arial;color:#e5e7eb;padding:20px">

  <div style="max-width:720px;margin:auto;background:#111827;border-radius:12px;overflow:hidden">

    <div style="padding:18px;background:#0b1220;text-align:center;border-bottom:1px solid #1f2937">
      <h2 style="margin:0;color:white">${subjek}</h2>
      <small style="color:#94a3b8">Secure System Report</small>
    </div>

    <div style="padding:20px">

      <table style="width:100%;border-collapse:collapse">

        ${Object.entries(vars)
          .map(
            ([k, v]) => `
          <tr>
            <td style="padding:10px;border:1px solid #1f2937;background:#1f2937;color:#94a3b8">
              ${k.toUpperCase()}
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
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    // anti spam
    if (!rateLimit(ip)) {
      return res.status(429).json({
        success: false,
        message: "Too many requests"
      });
    }

    const body = parseBody(req);

    // WAJIB
    if (!body.subjek || !body.pesan) {
      return res.status(400).json({
        success: false,
        message: "subjek dan pesan wajib diisi"
      });
    }

    // ======================
    // IMPORTANT FIX:
    // HTML USER DIABAIAKAN TOTAL
    // hanya diambil variabelnya saja
    // ======================
    const vars = extractVars(body.pesan);

    // inject ip server
    vars.ip = ip;

    // ======================
    // BUILD TEMPLATE (NO RAW HTML INPUT)
    // ======================
    const html = buildTemplate(vars, body.subjek);

    return res.json({
      success: true,
      subjek: body.subjek,
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
