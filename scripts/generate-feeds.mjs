import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = 'https://example.com';
const postsDir = join(process.cwd(), 'posts');
const manifest = JSON.parse(readFileSync(join(postsDir, 'index.json'), 'utf8'));

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (!m) return meta;
  m[1].split('\n').forEach((line) => {
    const [k, ...rest] = line.split(':');
    if (!k || !rest.length) return;
    meta[k.trim()] = rest.join(':').trim();
  });
  return meta;
}

const posts = manifest.map((item) => {
  const raw = readFileSync(join(postsDir, item.file), 'utf8');
  return { slug: item.slug, ...parseFrontmatter(raw) };
});

const rss = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0"><channel>\n<title>Byte & Brew</title>\n<link>${baseUrl}</link>\n<description>Blog markdown-first</description>\n${posts
  .map((p) => `<item><title>${p.title}</title><link>${baseUrl}/blog/${p.slug}</link><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${p.description || ''}</description></item>`)
  .join('\n')}\n</channel></rss>`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${baseUrl}/</loc></url>\n${posts.map((p) => `<url><loc>${baseUrl}/blog/${p.slug}</loc></url>`).join('\n')}\n</urlset>`;

writeFileSync('feed.xml', rss);
writeFileSync('sitemap.xml', sitemap);
console.log('feed.xml y sitemap.xml generados');
