// Zero-dependency server for the Snake race. It serves the page and proxies
// decisions to each lane's /v1/systemone endpoint, so API keys stay on the
// server and never reach the browser.
//
//   node server.mjs          # lanes from .env / environment
//   node server.mjs --mock   # also add two offline mock lanes

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOCK_PROFILES, mockSystemOne } from "./mock.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader; real environment variables win.
const envFile = path.join(here, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = process.env;
const PORT = Number(env.PORT || 5173);
const TIMEOUT_MS = Number(env.DECISION_TIMEOUT_MS || 10000);

export const lanes = {};
if (env.TYPESAFE_API_KEY) {
  lanes.jev = {
    label: `Jev (${env.JEV_MODEL || "jev-latest"})`,
    baseURL: env.JEV_BASE_URL || "https://api.typesafe.ai",
    model: env.JEV_MODEL || "jev-latest",
    apiKey: env.TYPESAFE_API_KEY,
  };
}
if (env.LAYA_BASE_URL) {
  lanes.laya = {
    label: `Laya (${env.LAYA_MODEL || "laya-multilingual"})`,
    baseURL: env.LAYA_BASE_URL,
    model: env.LAYA_MODEL || "laya-multilingual",
    apiKey: env.LAYA_API_KEY,
  };
}
if (process.argv.includes("--mock") || env.MOCK === "1" || Object.keys(lanes).length === 0) {
  for (const [id, p] of Object.entries(MOCK_PROFILES)) lanes[id] = { label: p.label, mock: true };
}

async function decide(laneId, state, questions) {
  const lane = lanes[laneId];
  if (!lane) return { status: 404, body: { error: `unknown lane "${laneId}"` } };
  const request = { model: lane.model, state, questions };
  const t0 = performance.now();
  try {
    let result;
    if (lane.mock) {
      result = await mockSystemOne(laneId, request);
    } else {
      const res = await fetch(`${lane.baseURL.replace(/\/$/, "")}/v1/systemone`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(lane.apiKey ? { authorization: `Bearer ${lane.apiKey}` } : {}),
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) return { status: 502, body: { error: `${lane.label} answered HTTP ${res.status}: ${text.slice(0, 300)}` } };
      result = JSON.parse(text);
    }
    return { status: 200, body: { upstreamMs: performance.now() - t0, result } };
  } catch (err) {
    return { status: 502, body: { error: `${lane.label}: ${err.message}` } };
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css" };

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/api/lanes") {
    const list = Object.entries(lanes).map(([id, l]) => ({ id, label: l.label, mock: !!l.mock }));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(list));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/decide") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      res.writeHead(400).end('{"error":"bad json"}');
      return;
    }
    const out = await decide(body.lane, body.state, body.questions);
    res.writeHead(out.status, { "content-type": "application/json" }).end(JSON.stringify(out.body));
    return;
  }
  if (req.method === "GET" && url.pathname === "/snake.mjs") return serveFile(res, path.join(here, "snake.mjs"));
  if (req.method === "GET") {
    const file = path.normalize(path.join(here, "public", url.pathname === "/" ? "index.html" : url.pathname));
    if (!file.startsWith(path.join(here, "public"))) return res.writeHead(403).end();
    return serveFile(res, file);
  }
  res.writeHead(405).end();
});

// Only bind when run directly, so bench.mjs can import `lanes` and `decide`.
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Snake race on http://127.0.0.1:${PORT}`);
    for (const [id, l] of Object.entries(lanes)) console.log(`  lane ${id.padEnd(10)} ${l.label}${l.mock ? "" : `  -> ${l.baseURL}`}`);
  });
}

export { decide };
