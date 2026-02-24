#!/usr/bin/env node
/**
 * Brave Search API helper for OpenClaw skills.
 * Usage:
 *   node scripts/brave-search.mjs "query" [count]
 * Env:
 *   BRAVE_API_KEY (required)
 */

import process from 'node:process';

const query = process.argv[2];
const count = Number(process.argv[3] ?? '8');

if (!query) {
  console.error('Missing query. Usage: node scripts/brave-search.mjs "query" [count]');
  process.exit(2);
}

const apiKey = process.env.BRAVE_API_KEY;
if (!apiKey) {
  console.error('Missing BRAVE_API_KEY env var');
  process.exit(2);
}

const url = new URL('https://api.search.brave.com/res/v1/web/search');
url.searchParams.set('q', query);
url.searchParams.set('count', String(Math.min(Math.max(count, 1), 20)));
url.searchParams.set('country', 'ALL');
url.searchParams.set('search_lang', 'en');

const res = await fetch(url, {
  headers: {
    'Accept': 'application/json',
    'X-Subscription-Token': apiKey,
  },
});

if (!res.ok) {
  const text = await res.text().catch(() => '');
  console.error(`Brave Search HTTP ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

const data = await res.json();
const results = (data?.web?.results ?? []).map(r => ({
  title: r.title,
  url: r.url,
  description: r.description,
  age: r.age,
  published: r.page_age,
  source: r.profile?.name,
}));

process.stdout.write(JSON.stringify({ query, count: results.length, results }, null, 2));
