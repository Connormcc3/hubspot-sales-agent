#!/usr/bin/env node
/**
 * Webfetch CLI tool — fetch and parse websites for research-outreach skill.
 *
 * Harness-agnostic: any local agent harness can call this instead of using
 * Claude Code's WebFetch tool.
 *
 * Usage:
 *   node src/tools/webfetch.js fetch --url <url> [--timeout <ms>]
 *   node src/tools/webfetch.js audit --url <url> [--type seo|ux|brand|tech|content]
 *
 * Output: JSON with structured findings (to stdout).
 */

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = val;
      if (val !== true) i++;
    }
  }
  return parsed;
}

async function fetchUrl(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sales-agent-research/1.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, status: res.status, url: res.url, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    return { ok: true, status: res.status, url: res.url, html };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.message };
  }
}

// Minimal HTML parser — extracts tag attributes without full DOM
function extractTags(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const matches = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push({ full: m[0], text: m[1].replace(/<[^>]*>/g, '').trim() });
  }
  return matches;
}

function extractMeta(html, name) {
  const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const m = html.match(regex);
  return m ? m[1] : null;
}

function countMatches(html, regex) {
  return (html.match(regex) || []).length;
}

function seoAudit(html) {
  const h1s = extractTags(html, 'h1');
  const h2s = extractTags(html, 'h2');
  const h3s = extractTags(html, 'h3');
  const images = countMatches(html, /<img[^>]*>/gi);
  const imagesWithAlt = countMatches(html, /<img[^>]*alt=["'][^"']+["'][^>]*>/gi);
  const imagesMissingAlt = images - imagesWithAlt;

  const title = extractTags(html, 'title')[0]?.text || '';
  const metaDescription = extractMeta(html, 'description');
  const hasSchema = /application\/ld\+json/i.test(html);
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
  const wordCount = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

  return {
    type: 'seo',
    findings: {
      title: { value: title, length: title.length, issue: title.length === 0 ? 'missing' : title.length > 60 ? 'too_long' : 'ok' },
      meta_description: { value: metaDescription, issue: !metaDescription ? 'missing' : metaDescription.length > 160 ? 'too_long' : 'ok' },
      h1_count: h1s.length,
      h1_issue: h1s.length === 0 ? 'missing' : h1s.length > 1 ? 'multiple' : 'ok',
      h2_count: h2s.length,
      h3_count: h3s.length,
      images_total: images,
      images_missing_alt: imagesMissingAlt,
      alt_coverage: images > 0 ? Math.round(((images - imagesMissingAlt) / images) * 100) : 100,
      has_schema_markup: hasSchema,
      has_viewport_meta: hasViewport,
      content_word_count: wordCount,
    },
  };
}

function genericAudit(html, type) {
  // Generic audit returns basic signals any audit type can use
  const h1s = extractTags(html, 'h1');
  const title = extractTags(html, 'title')[0]?.text || '';
  const wordCount = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const hasContactForm = /<form[^>]*>/i.test(html);
  const hasCTA = /<(a|button)[^>]*class=["'][^"']*(cta|btn|button)[^"']*["']/i.test(html);

  return {
    type,
    findings: {
      title,
      h1_headings: h1s.map(h => h.text).slice(0, 3),
      word_count: wordCount,
      has_contact_form: hasContactForm,
      has_cta_element: hasCTA,
      note: `Generic audit for ${type}. For full audit logic, extend this tool or use an external service.`,
    },
  };
}

async function fetchCmd(opts) {
  if (!opts.url) { console.error('Missing --url'); process.exit(1); }
  const result = await fetchUrl(opts.url, opts.timeout ? parseInt(opts.timeout) : undefined);
  if (!result.ok) {
    console.error(JSON.stringify({ error: result.error, status: result.status }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ url: result.url, status: result.status, html: result.html }, null, 2));
}

async function auditCmd(opts) {
  if (!opts.url) { console.error('Missing --url'); process.exit(1); }
  const type = opts.type || 'seo';

  const result = await fetchUrl(opts.url);
  if (!result.ok) {
    console.error(JSON.stringify({ error: result.error, status: result.status }, null, 2));
    process.exit(1);
  }

  let audit;
  if (type === 'seo') {
    audit = seoAudit(result.html);
  } else {
    audit = genericAudit(result.html, type);
  }

  console.log(JSON.stringify({
    url: result.url,
    status: result.status,
    audit,
  }, null, 2));
}

const [,, command, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!command || command === '--help') {
  console.log(`Usage: node src/tools/webfetch.js <command> [options]

Commands:
  fetch --url <url> [--timeout <ms>]
  audit --url <url> [--type seo|ux|brand|tech|content]

Examples:
  node src/tools/webfetch.js fetch --url https://example.com
  node src/tools/webfetch.js audit --url https://example.com --type seo

Note: Built-in audit logic covers basic SEO signals. For richer audits,
extend this tool or integrate external services (Lighthouse, PageSpeed, etc).`);
  process.exit(0);
}

const routes = {
  fetch: fetchCmd,
  audit: auditCmd,
};

const handler = routes[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Run with --help for usage.');
  process.exit(1);
}

handler(opts).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
