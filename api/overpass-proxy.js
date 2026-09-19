// Last-resort same-origin relay for Map Intelligence. The browser only calls this
// after every direct Overpass mirror has failed. It forwards the Overpass query
// text and nothing else: no property record, no photos, no storage, no logging
// of the request body. Upstream hosts are fixed server-side (not caller-chosen).
const UPSTREAMS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];
const MAX_QUERY_CHARS = 4000;
const UPSTREAM_TIMEOUT_MS = 8000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const query = typeof req.body?.query === "string" ? req.body.query : "";
  // Only accept the bounded, read-only query shape Plot Scout generates.
  if (!query || query.length > MAX_QUERY_CHARS || !query.startsWith("[out:json]") || /\b(out\s+meta|foreach|convert)\b/.test(query)) {
    return res.status(400).json({ error: "Invalid query" });
  }

  // Try one upstream per invocation window; keep total under typical function limits.
  const upstream = UPSTREAMS[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PlotScout/1.1 (map-intelligence relay)"
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    if (!r.ok) return res.status(502).json({ error: "Upstream map service error", status: r.status });
    const data = await r.json();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e?.name === "AbortError" ? 504 : 502).json({ error: "Map service unreachable" });
  } finally {
    clearTimeout(timer);
  }
}
