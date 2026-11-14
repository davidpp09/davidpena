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

## Publicar

El repo `davidpp09/davidpena` está conectado al proyecto **davidpena** de Vercel. Cada `git push` a `main` publica solo en https://davidpenapedraza.vercel.app.

`.vercelignore` deja fuera del sitio los archivos de trabajo (`SPEC.md`, `tests/`, este README y `.env*`).
