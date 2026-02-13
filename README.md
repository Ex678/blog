# Byte & Brew (Markdown-first)

## Ejecutar local

```bash
python3 -m http.server 4173
```

Abrir:
- Home: `http://127.0.0.1:4173/`
- Ruta limpia: `http://127.0.0.1:4173/blog/sistema-escritura-terminal`

> Nota: para rutas limpias en producción, configura fallback de servidor a `index.html`.

## Crear un nuevo post

1. Crear archivo `posts/mi-post.md` con frontmatter.
2. Añadir entrada en `posts/index.json` con `slug` y `file`.
3. Regenerar feeds:

```bash
node scripts/generate-feeds.mjs
```

## Frontmatter soportado

```md
---
title: Título
date: 2026-02-12
tags: js, markdown
description: Resumen SEO
cover: https://url-imagen
---
```
