import fetch from "node-fetch";
import * as cheerio from "cheerio";

const ALLOWLIST = [
  "dev.epicgames.com",
  "docs.unrealengine.com",
  "forums.unrealengine.com",
  "www.unrealengine.com"
];

const isAllowed = (raw) => {
  try {
    const { hostname } = new URL(raw);
    return ALLOWLIST.some(d => hostname.endsWith(d.replace(/^\*\./, "")));
  } catch { return false; }
};

const extractText = ($) => {
  const $root = $("article, main").first().length ? $("article, main").first() : $("body");
  // eliminar navegación / pie
  $root.find("nav, header, footer, script, style, noscript").remove();
  // concatenar títulos + párrafos
  let text = "";
  $root.find("h1,h2,h3,h4,h5,p,li,code,pre").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) text += t + "\n";
  });
  return text.trim();
};

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url || !isAllowed(url)) {
      return res.status(400).json({ error: "Missing or disallowed 'url' param" });
    }

    const resp = await fetch(url, {
      headers: { "User-Agent": "UnrealDocsProxy/1.0 (+educational; contact: none)" }
    });
    const html = await resp.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const content = extractText($).slice(0, 40000); // límite de seguridad

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=120");
    return res.status(200).json({
      url,
      title,
      length: content.length,
      content
    });
  } catch (err) {
    return res.status(500).json({ error: "Fetch failed", detail: String(err) });
  }
}
