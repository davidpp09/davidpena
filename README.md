# Sitio de David Peña

Un solo sitio estático (HTML, CSS y JS, sin build):

- `/` — demos de automatización con IA, la página que se manda a clientes.
- `/sobre-mi/` — portafolio personal (también incluye `archivo.html`, `cv.html` y `assets/`).

Las dos páginas se enlazan entre sí: "Sobre mí" en el menú y el pie de las demos, y la tarjeta "Demos de automatización con IA" en el portafolio.

## Verlo en local

```bash
python -m http.server 5174
```

Abre http://localhost:5174 y http://localhost:5174/sobre-mi/.

## Pruebas

```bash
node --test tests/
```

## Publicar en Vercel

1. Sube esta carpeta a un repo nuevo en GitHub.
2. En Vercel: **Add New → Project** → elige el repo → Framework Preset **Other**, sin build → **Deploy**.
3. Cada `git push` vuelve a publicar.
