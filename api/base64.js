import crypto from "crypto";

const rateLimitStore = global.rateLimitStore || new Map();
const duplicateStore = global.duplicateStore || new Map();

global.rateLimitStore = rateLimitStore;
global.duplicateStore = duplicateStore;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method Not Allowed"
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const now = Date.now();

    // Rate Limit
    const limitWindow = 60 * 1000;
    const maxRequest = 10;

    const requests =
      rateLimitStore.get(ip)?.filter(
        t => now - t < limitWindow
      ) || [];

    if (requests.length >= maxRequest) {
      return res.status(429).json({
        success: false,
        message: "Too Many Requests"
      });
    }

    requests.push(now);
    rateLimitStore.set(ip, requests);

    // Body
    const {
      subjek = "",
      pesan = "",
      sender = ""
    } = req.body || {};

    if (!subjek || !pesan) {
      return res.status(400).json({
        success: false,
        message: "Subjek dan pesan wajib diisi"
      });
    }

    if (pesan.length > 500000) {
      return res.status(413).json({
        success: false,
        message: "Payload terlalu besar"
      });
    }

    // Duplicate Check
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${subjek}|${pesan}|${sender}`)
      .digest("hex");

    const duplicateWindow = 5 * 60 * 1000;

    const lastSubmit =
      duplicateStore.get(fingerprint);

    if (
      lastSubmit &&
      now - lastSubmit < duplicateWindow
    ) {
      return res.status(409).json({
        success: false,
        message: "Duplicate payload detected"
      });
    }

    duplicateStore.set(
      fingerprint,
      now
    );

    // Cleanup
    for (const [key, value] of duplicateStore) {
      if (
        now - value >
        duplicateWindow
      ) {
        duplicateStore.delete(key);
      }
    }

    const brand = "Pusat Nya Stok🤤";

    const patterns = [
      /REAL KHA|KHA/gi,
      /RUL HOSTING/gi,
      /Grudabest/gi,
      /GanzzNesia62/gi
    ];

    let cleanSubject = subjek;
    let cleanMessage = pesan;

    for (const regex of patterns) {
      cleanSubject =
        cleanSubject.replace(regex, brand);

      cleanMessage =
        cleanMessage.replace(regex, brand);
    }

    return res.status(200).json({
      success: true,
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        subject: cleanSubject,
        content: cleanMessage
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
