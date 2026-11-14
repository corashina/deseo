// Fails when the gzip size of the JS and CSS that dist/index.html loads is over the budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const budget = 205_000;
const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
const size = files.reduce((total, file) => total + gzipSync(readFileSync(new URL(file, dist))).length, 0);
console.log(`First load: ${(size / 1000).toFixed(1)} kB gzip in ${files.length} files. Budget: ${budget / 1000} kB.`);
if (size > budget) process.exit(1);
