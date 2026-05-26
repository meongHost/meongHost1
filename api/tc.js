// api/tracker.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

const LOG_FILE = path.join(process.cwd(), "sites.json");
const HISTORY_FILE = path.join(process.cwd(), "sites_history.json");

const AUTH_TOKEN = "APINET-TRACKER-2025";
const MAX_HISTORY_DAYS = 30;

// ---------- Helper ----------
function respond(res, status, msg, extra = {}) {
  return res.status(status === "success" ? 200 : 400).json({
    status,
    msg,
    time: new Date().toISOString(),
    ...extra,
  });
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) || typeof data === "object"
      ? data
      : [];
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Handler ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return respond(res, "error", "Method not allowed");
  }

  try {
    // ---------- Input ----------
    let data = req.body;

    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    if (!data || typeof data !== "object") {
      return respond(res, "error", "Invalid JSON");
    }

    // ---------- Auth ----------
    const authHeader = req.headers.authorization || "";
    const bearer = authHeader.replace("Bearer ", "").trim();

    const token = data.token || bearer;

    if (token !== AUTH_TOKEN) {
      return respond(res, "error", "Unauthorized");
    }

    // ---------- Validate ----------
    let url;

    try {
      url = new URL(data.url).toString();
    } catch {
      return respond(res, "error", "Invalid URL");
    }

    const status = data.status || "online";

    const ip =
      data.server_ip ||
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    const ua =
      req.headers["user-agent"] ||
      data.user_agent ||
      "unknown";

    const id = crypto
      .createHash("md5")
      .update(url)
      .digest("hex");

    const now = new Date().toISOString();

    // ---------- Load DB ----------
    const db = readJSON(LOG_FILE);
    const history = readJSON(HISTORY_FILE);

    // ---------- Update / Insert ----------
    let found = false;
    let action = "added";
    let currentRow = null;

    for (let row of db) {
      if (row.id === id) {
        found = true;

        row.last_seen = now;
        row.ip = ip;
        row.user_agent = ua;
        row.info = data;
        row.update_count = (row.update_count || 0) + 1;

        currentRow = row;
        action = "updated";
        break;
      }
    }

    if (!found) {
      currentRow = {
        id,
        url,
        ip,
        added: now,
        last_seen: now,
        user_agent: ua,
        info: data,
        update_count: 1,
      };

      db.push(currentRow);
    }

    // ---------- History ----------
    if (!history[id]) {
      history[id] = [];
    }

    history[id].push({
      timestamp: now,
      ip,
      status,
    });

    // ---------- Cleanup ----------
    const limit =
      Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;

    for (const key in history) {
      history[key] = history[key].filter((entry) => {
        return new Date(entry.timestamp).getTime() >= limit;
      });
    }

    // ---------- Save ----------
    writeJSON(LOG_FILE, db);
    writeJSON(HISTORY_FILE, history);

    return respond(res, "success", "URL tracked", {
      action,
      id,
      url,
      status,
      update_count: currentRow.update_count,
      last_seen: now,
    });
  } catch (err) {
    return respond(res, "error", err.message);
  }
}
