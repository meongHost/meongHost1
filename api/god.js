const cheerio = require("cheerio");

// ======================
// NLP LABEL MAPPING
// ======================
const labelMap = {
  email: ["email", "e-mail", "mail"],
  user: ["user", "username", "nama", "name"],
  status: ["status", "state"],
  id: ["id", "order id", "ticket id"],
  ip: ["ip", "ip address"],
  device: ["device", "perangkat"],
  browser: ["browser"],
  city: ["city", "kota"],
  isp: ["isp", "provider"]
};

// ======================
// NORMALIZE LABEL
// ======================
function normalizeLabel(label = "") {
  const clean = label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

  for (const [key, aliases] of Object.entries(labelMap)) {
    if (aliases.includes(clean)) return key;
  }

  return clean.replace(/\s+/g, "_");
}

// ======================
// PARSE HTML TABLE
// ======================
function parseTable(html = "") {
  const $ = cheerio.load(html);
  const result = {};

  $("tr").each((_, row) => {
    const cols = $(row).find("td,th");

    if (cols.length >= 2) {
      const key = normalizeLabel($(cols[0]).text());
      const value = $(cols[1]).text().trim();

      if (key && value) {
        result[key] = value;
      }
    }
  });

  return result;
}

// ======================
// FALLBACK TEXT PARSER
// ======================
function fallbackScanner(text = "") {
  const result = {};

  const lines = text
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9 _-]{2,30})\s*[:=]\s*(.+)$/i);
    if (!match) continue;

    const key = normalizeLabel(match[1]);
    const value = match[2].trim();

    result[key] = value;
  }

  return result;
}

// ======================
// SMART PARSER ENGINE
// ======================
function smartParse(input = "") {
  let result = {};

  if (input.includes("<tr") || input.includes("<table")) {
    result = parseTable(input);
  }

  const fallback = fallbackScanner(input);

  return { ...result, ...fallback };
}

// ======================
// VERCEL API HANDLER
// ======================
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST only"
      });
    }

    const body =
      typeof req.body === "string"
        ? Object.fromEntries(new URLSearchParams(req.body))
        : req.body || {};

    if (!body.pesan) {
      return res.status(400).json({
        success: false,
        message: "pesan wajib diisi"
      });
    }

    const parsed = smartParse(body.pesan);

    return res.json({
      success: true,
      parsed
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
