const POSTS_INDEX = '/posts/index.json';
const THEME_KEY = 'bytebrew-theme';

const state = { posts: [], activeSlug: null };

const el = {
  search: document.getElementById('searchInput'),
  postList: document.getElementById('postList'),
  postMeta: document.getElementById('postMeta'),
  postTitle: document.getElementById('postTitle'),
  postDescription: document.getElementById('postDescription'),
  postCover: document.getElementById('postCover'),
  postBody: document.getElementById('postBody'),
  tocList: document.getElementById('tocList'),
  shareBtn: document.getElementById('shareBtn'),
  themeToggle: document.getElementById('themeToggle'),
  prevPost: document.getElementById('prevPost'),
  nextPost: document.getElementById('nextPost'),
  backToTop: document.getElementById('backToTop'),
  giscusContainer: document.getElementById('giscusContainer'),
};

bootstrap();

async function bootstrap() {
  wireEvents();
  syncThemeIcon();
  await loadPosts();
  renderPostList(state.posts);

  const initialSlug = getSlugFromPath() || state.posts[0]?.slug;
  if (initialSlug) openPost(initialSlug, false);
}

function wireEvents() {
  el.search.addEventListener('input', () => {
    const q = el.search.value.trim().toLowerCase();
    const filtered = state.posts.filter((p) => (`${p.meta.title} ${(p.meta.tags || []).join(' ')}`).toLowerCase().includes(q));
    renderPostList(filtered);
  });

  el.shareBtn.addEventListener('click', shareCurrentPost);
  el.themeToggle.addEventListener('click', toggleTheme);

  window.addEventListener('popstate', () => {
    const slug = getSlugFromPath() || state.posts[0]?.slug;
    if (slug) openPost(slug, false);
  });

  window.addEventListener('scroll', () => {
    const threshold = document.documentElement.scrollHeight * 0.5;
    const current = window.scrollY + window.innerHeight;
    el.backToTop.classList.toggle('hidden', current < threshold);
  });

  el.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

async function loadPosts() {
  const manifest = await fetchJson(POSTS_INDEX);
  const loaded = await Promise.all(
    manifest.map(async (item) => {
      const raw = await fetchText(`/posts/${item.file}`);
      const parsed = parseMarkdownFile(raw);
      const words = countWords(parsed.content);
      return {
        slug: item.slug,
        ...parsed,
        words,
        readTime: Math.max(1, Math.round(words / 220)),
      };
    })
  );

  state.posts = loaded.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));
}

function renderPostList(posts) {
  el.postList.innerHTML = '';
  posts.forEach((post) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.toggle('active', post.slug === state.activeSlug);
    btn.innerHTML = `<strong>${post.meta.title}</strong><br><small>${formatDate(post.meta.date)} · ${post.readTime} min</small>`;
    btn.addEventListener('click', () => openPost(post.slug, true));
    li.appendChild(btn);
    el.postList.appendChild(li);
  });
}

function openPost(slug, pushHistory = true) {
  const post = state.posts.find((p) => p.slug === slug);
  if (!post) return;
  state.activeSlug = slug;

  renderPostList(el.search.value ? state.posts.filter((p) => (`${p.meta.title} ${(p.meta.tags || []).join(' ')}`).toLowerCase().includes(el.search.value.toLowerCase())) : state.posts);

  const html = renderMarkdown(post.content);
  el.postMeta.textContent = `${formatDate(post.meta.date)} · ${post.readTime} min lectura · ${(post.meta.tags || []).join(', ')}`;
  el.postTitle.textContent = post.meta.title;
  el.postDescription.textContent = post.meta.description || '';
  el.postBody.innerHTML = html;

  if (post.meta.cover) {
    el.postCover.src = post.meta.cover;
    el.postCover.classList.remove('hidden');
  } else {
    el.postCover.classList.add('hidden');
  }

  enhanceImagesLazy(el.postBody);
  buildToc();
  setupPrevNext(slug);
  updateSeo(post);
  mountGiscus(post.slug);

  if (window.Prism) window.Prism.highlightAllUnder(el.postBody);

  const targetPath = `/blog/${slug}`;
  if (pushHistory && location.pathname !== targetPath) {
    history.pushState({}, '', targetPath);
  }
}

function parseMarkdownFile(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const [, frontmatter, content] = match;
  const meta = {};
  frontmatter.split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (!key || !rest.length) return;
    const value = rest.join(':').trim();
    if (key.trim() === 'tags') {
      meta.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      meta[key.trim()] = value;
    }
  });

  return { meta, content: content.trim() };
}

function renderMarkdown(md) {
  let html = md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = '', code) => `<pre><code class="language-${lang.toLowerCase()}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/^### (.*$)/gim, (_, t) => `<h3 id="${slugify(t)}">${t}</h3>`)
    .replace(/^## (.*$)/gim, (_, t) => `<h2 id="${slugify(t)}">${t}</h2>`)
    .replace(/^# (.*$)/gim, (_, t) => `<h1 id="${slugify(t)}">${t}</h1>`)
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1" loading="lazy" decoding="async" />')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^\- (.*)$/gim, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>');

  html = `<p>${html}</p>`
    .replace(/<p><h/g, '<h')
    .replace(/<\/h([1-3])><\/p>/g, '</h$1>')
    .replace(/<p><pre>/g, '<pre>')
    .replace(/<\/pre><\/p>/g, '</pre>')
    .replace(/<p><li>/g, '<ul><li>')
    .replace(/<\/li><\/p>/g, '</li></ul>')
    .replace(/<\/li>\n<li>/g, '</li><li>');

  return html;
}

function buildToc() {
  const headings = [...el.postBody.querySelectorAll('h2, h3')];
  el.tocList.innerHTML = '';

  headings.forEach((h) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    if (h.tagName.toLowerCase() === 'h3') a.classList.add('h3');
    li.appendChild(a);
    el.tocList.appendChild(li);
  });

  const tocLinks = [...el.tocList.querySelectorAll('a')];
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tocLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`));
        }
      });
    },
    { rootMargin: '0px 0px -70% 0px', threshold: 1 }
  );

  headings.forEach((h) => observer.observe(h));
}

function setupPrevNext(slug) {
  const idx = state.posts.findIndex((p) => p.slug === slug);
  const prev = state.posts[idx + 1];
  const next = state.posts[idx - 1];

  bindAdjacentLink(el.prevPost, prev, '← Post anterior');
  bindAdjacentLink(el.nextPost, next, 'Post siguiente →');
}

function bindAdjacentLink(anchor, post, label) {
  if (!post) {
    anchor.textContent = '';
    anchor.removeAttribute('href');
    anchor.style.pointerEvents = 'none';
    anchor.style.opacity = '.4';
    return;
  }
  anchor.style.pointerEvents = 'auto';
  anchor.style.opacity = '1';
  anchor.href = `/blog/${post.slug}`;
  anchor.textContent = `${label}: ${post.meta.title}`;
  anchor.onclick = (e) => {
    e.preventDefault();
    openPost(post.slug, true);
  };
}

function updateSeo(post) {
  document.title = `${post.meta.title} | Byte & Brew`;
  setMeta('description', post.meta.description || '');
}

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function mountGiscus(term) {
  el.giscusContainer.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-repo', 'owner/repo');
  script.setAttribute('data-repo-id', 'REPO_ID');
  script.setAttribute('data-category', 'General');
  script.setAttribute('data-category-id', 'CATEGORY_ID');
  script.setAttribute('data-mapping', 'specific');
  script.setAttribute('data-term', term);
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'top');
  script.setAttribute('data-theme', 'preferred_color_scheme');
  script.setAttribute('data-lang', 'es');
  el.giscusContainer.appendChild(script);
}

async function shareCurrentPost() {
  const post = state.posts.find((p) => p.slug === state.activeSlug);
  if (!post) return;
  const payload = { title: post.meta.title, text: post.meta.description, url: location.href };

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch {
      // fallback clipboard
    }
  }

  await navigator.clipboard.writeText(location.href);
  alert('Enlace copiado al portapapeles');
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);

  syncThemeIcon();
}

function syncThemeIcon() {
  const next = document.documentElement.dataset.theme;
  const icon = el.themeToggle.querySelector('img');
  icon.src = next === 'dark' ? 'assets/icons/moon.svg' : 'assets/icons/sun.svg';
}

function enhanceImagesLazy(root) {
  root.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
  });
}

function getSlugFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'blog' && parts[1]) return parts[1];
  return null;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function countWords(text) {
  return (text.match(/\b\w+\b/g) || []).length;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
  return r.text();
}
