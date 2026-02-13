const STORAGE_KEY = "bytebrew-posts";
const DRAFT_KEY = "bytebrew-autosave";
const AUTH_KEY = "bytebrew-editor-auth";
const DEMO_PIN = "bytebrew";

const state = { posts: loadPosts(), selectedId: null, coverImage: "" };

const el = {
  editorView: document.getElementById("editorView"),
  readerView: document.getElementById("readerView"),
  goEditorBtn: document.getElementById("goEditorBtn"),
  goReaderBtn: document.getElementById("goReaderBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginDialog: document.getElementById("loginDialog"),
  pinInput: document.getElementById("pinInput"),
  confirmLoginBtn: document.getElementById("confirmLoginBtn"),
  title: document.getElementById("titleInput"),
  tags: document.getElementById("tagsInput"),
  content: document.getElementById("contentInput"),
  preview: document.getElementById("preview"),
  postList: document.getElementById("postList"),
  search: document.getElementById("searchInput"),
  statusFilter: document.getElementById("filterStatus"),
  wordCount: document.getElementById("wordCount"),
  readTime: document.getElementById("readTime"),
  autosaveState: document.getElementById("autosaveState"),
  totalPosts: document.getElementById("totalPosts"),
  totalWords: document.getElementById("totalWords"),
  focusMeter: document.getElementById("focusMeter"),
  coverInput: document.getElementById("coverInput"),
  importInput: document.getElementById("importInput"),
  readerSearch: document.getElementById("readerSearch"),
  readerList: document.getElementById("readerList"),
  readerArticle: document.getElementById("readerArticle"),
  template: document.getElementById("postItemTemplate"),
};

document.getElementById("newPostBtn").addEventListener("click", resetEditor);
document.getElementById("saveDraftBtn").addEventListener("click", () => savePost("draft"));
document.getElementById("publishBtn").addEventListener("click", () => savePost("published"));
document.getElementById("exportBtn").addEventListener("click", exportPosts);

el.goEditorBtn.addEventListener("click", openEditor);
el.goReaderBtn.addEventListener("click", () => openReader());
el.loginBtn.addEventListener("click", () => el.loginDialog.showModal());
el.logoutBtn.addEventListener("click", () => { localStorage.removeItem(AUTH_KEY); openReader(); });
el.confirmLoginBtn.addEventListener("click", (e) => {
  if (el.pinInput.value !== DEMO_PIN) {
    e.preventDefault();
    el.pinInput.setCustomValidity("PIN incorrecto");
    el.pinInput.reportValidity();
    return;
  }
  el.pinInput.setCustomValidity("");
  localStorage.setItem(AUTH_KEY, "ok");
  openEditor();
});

el.search.addEventListener("input", renderList);
el.statusFilter.addEventListener("change", renderList);
el.coverInput.addEventListener("change", handleCoverUpload);
el.importInput.addEventListener("change", importPosts);
el.readerSearch.addEventListener("input", renderReaderList);

el.content.addEventListener("input", () => { updatePreview(); updateMetrics(); autosaveDraft(); });
[el.title, el.tags].forEach((input) => input.addEventListener("input", autosaveDraft));
document.querySelectorAll("[data-snippet]").forEach((btn) => btn.addEventListener("click", () => insertSnippet(btn.dataset.snippet)));
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); savePost("draft"); }
});

hydrateFromDraft();
updatePreview();
updateMetrics();
renderList();
renderReaderList();
openReader();

function openEditor() {
  if (localStorage.getItem(AUTH_KEY) !== "ok") return el.loginDialog.showModal();
  el.readerView.classList.add("hidden");
  el.editorView.classList.remove("hidden");
}

function openReader(postId) {
  el.editorView.classList.add("hidden");
  el.readerView.classList.remove("hidden");
  const published = state.posts.filter((p) => p.status === "published");
  const chosen = published.find((p) => p.id === postId) || published[0];
  renderReaderArticle(chosen);
}

function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function persistPosts() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts)); }
function autosaveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(collectForm("draft")));
  el.autosaveState.textContent = `Autosave ${new Date().toLocaleTimeString()}`;
}

function hydrateFromDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    el.title.value = draft.title || "";
    el.tags.value = draft.tags?.join(", ") || "";
    el.content.value = draft.content || "";
    state.coverImage = draft.coverImage || "";
  } catch {}
}

function collectForm(status) {
  return {
    id: state.selectedId || crypto.randomUUID(),
    status,
    title: el.title.value.trim() || "Sin título",
    tags: parseTags(el.tags.value),
    content: el.content.value,
    coverImage: state.coverImage,
    updatedAt: new Date().toISOString(),
    words: countWords(el.content.value),
  };
}

function savePost(status) {
  const post = collectForm(status);
  const idx = state.posts.findIndex((item) => item.id === post.id);
  if (idx >= 0) state.posts[idx] = post; else state.posts.unshift(post);
  state.selectedId = post.id;
  persistPosts();
  renderList();
  renderReaderList();
  updateMetrics();
  el.autosaveState.textContent = status === "published" ? "Publicado ✅" : "Borrador guardado ✅";
}

function renderList() {
  const query = el.search.value.toLowerCase();
  const filter = el.statusFilter.value;
  el.postList.innerHTML = "";
  state.posts
    .filter((p) => (filter === "all" ? true : p.status === filter))
    .filter((p) => `${p.title} ${p.tags.join(" ")}`.toLowerCase().includes(query))
    .forEach((post) => {
      const node = el.template.content.cloneNode(true);
      const button = node.querySelector(".post-item");
      button.dataset.status = post.status;
      node.querySelector(".title").textContent = post.title;
      node.querySelector(".meta").textContent = `${post.status} · ${formatDate(post.updatedAt)}`;
      button.addEventListener("click", () => loadPost(post.id));
      el.postList.appendChild(node);
    });
  const words = state.posts.reduce((acc, post) => acc + (post.words || 0), 0);
  el.totalPosts.textContent = String(state.posts.length);
  el.totalWords.textContent = String(words);
  el.focusMeter.textContent = String(Math.max(1, Math.round(words / 220)));
}

function renderReaderList() {
  const query = el.readerSearch.value.toLowerCase();
  el.readerList.innerHTML = "";
  state.posts
    .filter((p) => p.status === "published")
    .filter((p) => `${p.title} ${p.tags.join(" ")}`.toLowerCase().includes(query))
    .forEach((post) => {
      const node = el.template.content.cloneNode(true);
      const button = node.querySelector(".post-item");
      button.dataset.status = "published";
      node.querySelector(".title").textContent = post.title;
      node.querySelector(".meta").textContent = `${formatDate(post.updatedAt)} · ${post.words || 0} palabras`;
      button.addEventListener("click", () => renderReaderArticle(post));
      el.readerList.appendChild(node);
    });
}

function renderReaderArticle(post) {
  if (!post) {
    el.readerArticle.innerHTML = "<h2>No hay posts publicados aún</h2><p>Publica uno desde modo editor.</p>";
    return;
  }
  const tags = post.tags.map((t) => `<code>#${t}</code>`).join(" ");
  el.readerArticle.innerHTML = `${post.coverImage ? `<img src="${post.coverImage}" alt="Portada" />` : ""}<h1>${post.title}</h1><p>${formatDate(post.updatedAt)} · ${Math.max(1, Math.round((post.words || 0) / 220))} min</p><p>${tags}</p><hr/>${renderMarkdown(post.content)}`;
}

function loadPost(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  state.selectedId = post.id;
  state.coverImage = post.coverImage || "";
  el.title.value = post.title;
  el.tags.value = post.tags.join(", ");
  el.content.value = post.content;
  updatePreview();
  updateMetrics();
}

function resetEditor() { state.selectedId = null; state.coverImage = ""; el.title.value = ""; el.tags.value = ""; el.content.value = ""; updatePreview(); updateMetrics(); }
function parseTags(raw) { return raw.split(",").map((tag) => tag.trim()).filter(Boolean); }
function countWords(text) { return (text.match(/\b\w+\b/g) || []).length; }
function updateMetrics() { const words = countWords(el.content.value); el.wordCount.textContent = `${words} palabras`; el.readTime.textContent = `${Math.max(1, Math.round(words / 220))} min lectura`; }

function insertSnippet(snippet) {
  const area = el.content;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const before = area.value.slice(0, start);
  const selected = area.value.slice(start, end);
  const after = area.value.slice(end);
  const value = snippet.includes("texto") ? snippet.replace("texto", selected || "texto") : `${snippet}${selected}`;
  area.value = `${before}${value}${after}`;
  area.focus();
  updatePreview();
  updateMetrics();
  autosaveDraft();
}

function renderMarkdown(text) {
  let html = escapeHtml(text)
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/^- (.*)$/gim, "<li>$1</li>")
    .replace(/\n$/gim, "<br />");
  return html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
}

function updatePreview() {
  const cover = state.coverImage ? `<img src="${state.coverImage}" alt="Portada del artículo" />` : "";
  el.preview.innerHTML = `${cover}${renderMarkdown(el.content.value) || "<p>La vista previa aparecerá aquí...</p>"}`;
}

function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function formatDate(iso) { return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }

function handleCoverUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { state.coverImage = String(reader.result || ""); updatePreview(); autosaveDraft(); };
  reader.readAsDataURL(file);
}

function exportPosts() {
  const blob = new Blob([JSON.stringify(state.posts, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bytebrew-backup-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importPosts(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result || "[]"));
      if (!Array.isArray(imported)) throw new Error("Formato inválido");
      state.posts = imported;
      persistPosts();
      renderList();
      renderReaderList();
      openReader();
    } catch {
      el.autosaveState.textContent = "Error al importar JSON";
    }
  };
  reader.readAsText(file);
}
