// Builds a static privacy-policy page from PRIVACY.md for GitHub Pages.
// Usage: node scripts/build-privacy-site.mjs
// Output: _site/index.html

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "PRIVACY.md"), "utf8");

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Split into blocks on blank lines, then classify each block.
const blocks = md
  .split(/\r?\n[ \t]*\r?\n/)
  .map((b) => b.split(/\r?\n/).map((l) => l.trim()))
  .filter((b) => b.length > 0 && b.some((l) => l !== ""));

const html = [];
for (const block of blocks) {
  const first = block[0];
  const heading = first.match(/^(#{1,3})\s+(.*)/);
  if (heading) {
    html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    continue;
  }
  if (block.every((l) => /^[-*]\s+/.test(l))) {
    html.push("<ul>");
    for (const line of block) {
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    }
    html.push("</ul>");
    continue;
  }
  if (first.startsWith(">")) {
    html.push(`<blockquote>${inline(first.replace(/^>\s?/, ""))}</blockquote>`);
    continue;
  }
  html.push(`<p>${inline(block.join(" "))}</p>`);
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TraceGuard Privacy Policy</title>
<meta name="description" content="Privacy policy for the TraceGuard privacy scoring Chrome extension.">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #000000;
    color: #e5e7eb;
    font-family: "Inter", "Liberation Sans", Arial, system-ui, sans-serif;
    line-height: 1.65;
  }
  header {
    display: flex; align-items: center; gap: 14px;
    padding: 22px 28px;
    border-bottom: 1px solid #1f2937;
  }
  header .wordmark { font-size: 20px; font-weight: 700; color: #ffffff; }
  header .tag { color: #9ca3af; font-size: 13px; }
  main { max-width: 760px; margin: 0 auto; padding: 40px 28px 64px; }
  h1 { font-size: 28px; color: #ffffff; margin: 0 0 6px; }
  h2 { font-size: 20px; color: #ffffff; margin-top: 36px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; }
  h3 { font-size: 16px; color: #ffffff; }
  p { margin: 14px 0; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  a { color: #7dd3fc; }
  code { background: #111827; padding: 1px 6px; border-radius: 4px; font-size: 0.9em; }
  blockquote { border-left: 3px solid #374151; margin: 14px 0; padding: 4px 16px; color: #9ca3af; }
  footer { text-align: center; color: #6b7280; font-size: 13px; padding: 24px; border-top: 1px solid #1f2937; }
  .date { color: #9ca3af; font-size: 14px; }
</style>
</head>
<body>
<header>
  <div>
    <div class="wordmark">TraceGuard</div>
    <div class="tag">Privacy Policy</div>
  </div>
</header>
<main>
${html.join("\n")}
</main>
<footer>TraceGuard Privacy Extension &middot; traceguardprivacyextension@gmail.com</footer>
</body>
</html>
`;

mkdirSync(join(root, "_site"), { recursive: true });
writeFileSync(join(root, "_site", "index.html"), page, "utf8");
console.log("Wrote _site/index.html");
