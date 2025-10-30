import fetch from "node-fetch";
import * as cheerio from "cheerio";

const DUCK_HTML = "https://html.duckduckgo.com/html";
const ALLOWLIST = [
  "dev.epicgames.com",
  "docs.unrealengine.com",
  "forums.unrealengine.com",
  "www.unrealengine.com" // para marketplace
];

// helpers
const isAllowed = (url) => {
  try {
    const { hostname } = new URL(url);
    return ALLOWLIST.some(d => hostname.endsWith(d.replace(/^\*\./, "")));
  } catch { return false; }
};

export default async function handler(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Missing or too short 'q' param" });
    }

    // Respetar uso justo: cache corto y user-agent claro
    const resp = await fetch(DUCK_HTML, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "UnrealDocsProxy/1.0 (+educational; contact: none)"
      },
      body: new URLSearchParams({
        q: q,          // tu consulta, ej: site:dev.epicgames.com "Line Trace By Channel"
        kl: "us-en",
        df: "y"        // time filter (y=year) opcional
      })
    });

    const html = await resp.text();
    const $ = cheerio.load(html);

    const results = [];
    $(".result__a").each((_, el) => {
      const title = $(el).text().trim();
      const url = $(el).attr("href");
      if (!url || !isAllowed(url)) return;
      // snippet
      const snippet = $(el).parent().find(".result__snippet").text().trim();
      results.push({ title, url, snippet });
    });

    // respuesta
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
    return res.status(200).json({
      query: q,
      count: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({ error: "Search failed", detail: String(err) });
  }
}
