// House-style check for Kaizen marketing copy. Agent-agnostic: any person or
// agent can run it before and after editing a page.
//
//   node scripts/audit/house-style.mjs                      all pages in the live sitemap
//   node scripts/audit/house-style.mjs /about/ /contact/    selected live pages
//   node scripts/audit/house-style.mjs --dist dist /about/  pages from a local build
//   add --verbose to print every offending line
//   In Git Bash on Windows, prefix with MSYS_NO_PATHCONV=1 so /paths/ stay URLs.
//
// Hard rules (exit code 1 if any page breaks one): no em or en dashes, no
// exclamation marks, British spelling, no banned hype words.
// Soft targets (reported, not failed): reading age about 9 (we accept up to 10
// on marketing pages), average sentence 12 words or fewer, no sentence over 20
// words, no staffing words, few AI-sounding patterns.
// Rules come from .claude/skills/marketing-messaging/SKILL.md ("House voice")
// and docs/marketing/site-profile.md. British English: "licence" is the noun
// and "license" the verb, so only the noun form is flagged.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const distIndex = args.indexOf("--dist");
const dist = distIndex >= 0 ? args[distIndex + 1] : null;
const pages = args.filter((a, i) => !a.startsWith("--") && !(distIndex >= 0 && i === distIndex + 1));
const origin = "https://kaizenweb.co.uk";

const rules = {
  dash: { re: /[—–]|\s-\s/g, hard: true, label: "dash" },
  exclaim: { re: /!/g, hard: true, label: "exclamation mark" },
  us: { re: /\b(optimiz\w*|organiz\w*|prioritiz\w*|customiz\w*|realiz\w*|analyz\w*|behavior\w*|color(s|ed|ful)?|center(s|ed)?|favorite\w*|catalog\b|defense|(?:a|an|the|on|under|this|your|our|their) license\b|gray|traveling|canceled|modeling|labeled|utiliz\w*|minimiz\w*|maximiz\w*|recogniz\w*|specializ\w*)\b/gi, hard: true, label: "US spelling" },
  hype: { re: /\b(seamless(ly)?|streamlin\w*|leverag\w*|cutting[- ]edge|robust|unlock\w*|empower\w*|revolutioni[sz]\w*|game[- ]chang\w*|hassle[- ]free|effortless(ly)?|delve|elevat\w*|harness\w*|unleash\w*|supercharg\w*|next[- ]level|world[- ]class|state[- ]of[- ]the[- ]art|best[- ]in[- ]class|holistic|synerg\w*|transformative|tapestry|in today's)\b/gi, hard: true, label: "banned word" },
  staff: { re: /\b(our team|the team|my team|developers on|junior|senior|staff|our experts|in-house team|freelancer|full-service agency|agency of one|solo)\b/gi, hard: false, label: "staffing word" },
  ai: { re: /(\bnot just\b|\bactually\b|isn't [^.]{1,40}\. it's|that's not [^.]{1,40}[.,] it's|here's the thing|the truth is|let's face it|has you covered|peace of mind|\bNo [A-Z]?[a-z]+\. No [a-z]+\. No [a-z]+\.|\? (Good|Exactly|Simple)\.)/gi, hard: false, label: "AI-sounding pattern" },
};

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&hellip;/g, "...").replace(/&rarr;|&larr;/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const strip = (h) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function bodyLines(html) {
  let b = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  b = b.replace(/<(script|style|svg|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(header|nav|footer)\b[\s\S]*?<\/\1>/gi, " ");
  b = b.replace(/<\/?(p|div|li|h[1-6]|section|article|br|td|th|tr|button|summary|figcaption|blockquote|dt|dd|label)[^>]*>/gi, "\n");
  return b.split("\n").map(strip).filter((t) => t.length > 1);
}

const syllables = (w) => {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};

async function load(page) {
  if (dist) {
    const file = path.join(dist, page.replace(/^\//, ""), page.endsWith(".html") ? "" : "index.html");
    return fs.readFileSync(file, "utf8");
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(origin + page);
      if (res.ok) return await res.text();
      throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

async function sitemapPages() {
  const xml = await (await fetch(`${origin}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(origin, ""));
}

const list = pages.length ? pages : await sitemapPages();
let hardFails = 0;
console.log("page\treadingAge\tavgSentence\tlong>20\t" + Object.values(rules).map((r) => r.label).join("\t"));
for (const page of list) {
  let html;
  try { html = await load(page); } catch (error) { console.log(`${page}\tERROR ${error.message}`); continue; }
  const lines = bodyLines(html);
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const desc = decode((html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) || [])[1] || "");
  const text = [title, desc, ...lines];
  const prose = lines.filter((l) => l.split(" ").length >= 4).join(" ");
  const sentences = prose.split(/(?<=[.?!])\s+/).filter((s) => s.split(/\s+/).length >= 3);
  const words = prose.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const asl = words.length / Math.max(1, sentences.length);
  const grade = 0.39 * asl + 11.8 * (syl / Math.max(1, words.length)) - 15.59;
  const long = sentences.filter((s) => s.split(/\s+/).length > 20);
  const hits = {};
  for (const [key, rule] of Object.entries(rules)) {
    hits[key] = [];
    for (const line of text) for (const m of line.matchAll(rule.re)) hits[key].push({ match: m[0], line: line.length > 180 ? line.slice(Math.max(0, m.index - 70), m.index + 100) : line });
    if (rule.hard && hits[key].length) hardFails++;
  }
  console.log([page, (grade + 5).toFixed(1), asl.toFixed(1), long.length, ...Object.keys(rules).map((k) => hits[k].length)].join("\t"));
  if (verbose) {
    for (const [key, rule] of Object.entries(rules)) for (const h of hits[key]) console.log(`    ${rule.label}: "${h.match}" in: ${h.line}`);
    for (const s of long) console.log(`    long sentence (${s.split(/\s+/).length} words): ${s.slice(0, 200)}`);
  }
}
if (hardFails) {
  console.log(`\n${hardFails} hard-rule breach(es). Fix them before shipping.`);
  process.exitCode = 1;
}
