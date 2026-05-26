// api/tc.js

import fs from "fs";
import path from "path";
import crypto from "crypto";

const LOG_FILE = path.join(process.cwd(), "sites.json");
const HISTORY_FILE = path.join(process.cwd(), "sites_history.json");

// TOKEN LANGSUNG
const AUTH_TOKEN = "APINET-TRACKER-2025";

const MAX_HISTORY_DAYS = 30;

// =========================
// RESPONSE
// =========================
function respond(
  res,
  status,
  msg,
  extra = {},
  code = 200
) {
  return res.status(code).json({
    status,
    msg,
    time: new Date().toISOString(),
    ...extra,
  });
}

// =========================
// READ JSON
// =========================
function readJSON(file) {
  try {

    if (!fs.existsSync(file)) {
      return [];
    }

    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );

  } catch {

    return [];
  }
}

// =========================
// WRITE JSON
// =========================
function writeJSON(file, data) {

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

// =========================
// MAIN
// =========================
export default async function handler(
  req,
  res
) {

  // =========================
  // CORS
  // =========================
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // PREFLIGHT
  if (req.method === "OPTIONS") {

    return res.status(200).end();
  }

  // =========================
  // GET
  // =========================
  if (req.method === "GET") {

    return respond(
      res,
      "success",
      "API ONLINE",
      {
        uptime: process.uptime(),
      }
    );
  }

  // =========================
  // ONLY POST
  // =========================
  if (req.method !== "POST") {

    return respond(
      res,
      "error",
      "Method not allowed",
      {},
      405
    );
  }

  try {

    // =========================
    // BODY
    // =========================
    let data = req.body;

    if (typeof data === "string") {

      data = JSON.parse(data);
    }

    if (
      !data ||
      typeof data !== "object"
    ) {

      return respond(
        res,
        "error",
        "Invalid JSON",
        {},
        400
      );
    }

    // =========================
    // AUTH
    // =========================
    const authHeader =
      req.headers.authorization || "";

    const bearer = authHeader
      .replace("Bearer ", "")
      .trim();

    const token =
      data.token || bearer;

    if (token !== AUTH_TOKEN) {

      return respond(
        res,
        "error",
        "Unauthorized",
        {},
        401
      );
    }

    // =========================
    // URL VALIDATION
    // =========================
    let url;

    try {

      url = new URL(
        data.url
      ).toString();

    } catch {

      return respond(
        res,
        "error",
        "Invalid URL",
        {},
        400
      );
    }

    // BLOCKED URL
    if (
      url.includes("localhost") ||
      url.includes("127.0.0.1")
    ) {

      return respond(
        res,
        "error",
        "Blocked URL",
        {},
        403
      );
    }

    // =========================
    // DATA
    // =========================
    const status =
      data.status || "online";

    const ip =
      data.server_ip ||
      req.headers[
        "x-forwarded-for"
      ] ||
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

    const now =
      new Date().toISOString();

    // =========================
    // LOAD DATABASE
    // =========================
    const db =
      readJSON(LOG_FILE);

    const history =
      readJSON(HISTORY_FILE);

    // =========================
    // UPDATE / INSERT
    // =========================
    let found = false;

    let action = "added";

    let currentRow = null;

    for (let row of db) {

      if (row.id === id) {

        found = true;

        row.last_seen = now;

        row.ip = ip;

        row.user_agent = ua;

        row.status = status;

        row.info = data;

        row.total_hits =
          (row.total_hits || 0) + 1;

        currentRow = row;

        action = "updated";

        break;
      }
    }

    // INSERT
    if (!found) {

      currentRow = {

        id,
        url,
        ip,
        status,

        added: now,

        last_seen: now,

        user_agent: ua,

        info: data,

        total_hits: 1,
      };

      db.push(currentRow);
    }

    // =========================
    // HISTORY
    // =========================
    if (!history[id]) {

      history[id] = [];
    }

    history[id].push({

      timestamp: now,

      ip,

      status,
    });

    // =========================
    // CLEAN HISTORY
    // =========================
    const limit =
      Date.now() -
      (
        MAX_HISTORY_DAYS *
        24 *
        60 *
        60 *
        1000
      );

    for (const key in history) {

      history[key] =
        history[key].filter(
          (entry) => {

            return (
              new Date(
                entry.timestamp
              ).getTime() >= limit
            );
          }
        );
    }

    // =========================
    // SAVE
    // =========================
    writeJSON(
      LOG_FILE,
      db
    );

    writeJSON(
      HISTORY_FILE,
      history
    );

    // =========================
    // SUCCESS
    // =========================
    return respond(
      res,
      "success",
      "URL tracked",
      {
        action,
        id,
        url,
        status,
        total_hits:
          currentRow.total_hits,
        last_seen: now,
      }
    );

  } catch (err) {

    return respond(
      res,
      "error",
      err.message,
      {},
      500
    );
  }
}    let url;

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
