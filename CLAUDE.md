# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Academic demo e-commerce ("IWNZ Tech") in plain HTML/CSS/vanilla JS — no build step, no package manager, no tests, no linter, no backend. All UI text and code comments are in Brazilian Portuguese (`pt-BR`, prices in BRL); keep new text and comments in Portuguese.

Two apps that share data through browser storage:

- `Loja/` — customer storefront (`index.html` + `pedido-confirmado.html`, shared `style.css`, `script.js`).
- `Dashboard/` — admin panel ("Minha Loja") for registering/listing products and clients and viewing store orders.
- `Compartilhado/dados.js` — storage keys, initial catalog and helpers shared by both apps.
- `Compartilhado/favicon.svg` — tab icon (the "I" brand mark, purple→blue gradient matching `--accent`/`--accent-2`), linked via `<link rel="icon" href="../Compartilhado/favicon.svg">` in all three pages; any new page should link it too.

## Running

Serve over HTTP (the storefront loads `script.js` as `type="module"`, which fails on `file://`):

```bash
python3 -m http.server 8000   # then open /Loja/ or /Dashboard/
```

Dashboard demo login: `admin@admin.com` / `adminadmin` (hard-coded in `Auth.DEMO`, `Dashboard/script.js`).

## Architecture

### Persistence is browser storage only — shared between the two apps

Both apps must be served from the same origin (same `http.server`) so they see the same localStorage. `Compartilhado/dados.js` (classic script, loaded before each app's script) exposes `window.IWNZ_DADOS`: the shared keys (`loja:v2:produtos`, `loja:v2:clientes`, `loja:v2:pedidos`), `CATEGORIAS`, `META_MENSAL`, the initial catalog (seeded on first read by `produtos()`), and `ler`/`gravar` helpers. Data flow:

- Products: created/edited in the Dashboard; the store reads them via `loadCatalog()`/`toStoreProduct()` (Dashboard field names `nome`, `preco`, `precoAntigo`, `estoque`, `imagem`, `destaque`… are mapped to the store's `name`, `price`, …). Product ids are strings.
- Store sign-ups also create a client in `loja:v2:clientes` (`origem: "loja"`); LGPD account deletion removes it and anonymizes that user's orders.
- Store checkout appends to `loja:v2:pedidos` and decrements `estoque`; the Dashboard's `Store.vendasSemana()` computes the weekly bars, monthly goal and average ticket from those orders in demo mode.
- Both apps listen to the `storage` event and re-render when another tab changes shared data.

Store-only keys stay in the `KEYS` object at the top of `Loja/script.js` (`iwnz_cart`, `iwnz_users`, `iwnz_current_user`, `iwnz_accessibility`, `iwnz_cookie_consent`, `iwnz_newsletter` in localStorage; `iwnz_last_order` in **sessionStorage**) — go through `loadStorage`/`saveStorage`/`removeStorage`. Dashboard session: `loja:sessao` (sessionStorage).

### Storefront (`Loja/script.js`)

Single file split into numbered sections (`// 1.` … `// 15.`): constants/keys → shared catalog → helpers → toast → global state → modals → catalog (filter/search/sort) → cart → auth → accessibility → legal/LGPD → cookies → newsletter → cross-tab sync → `init()`. Each feature has a `bindX()` function wired up in `init()`.

- Modals are native `<dialog>` elements; any element with `data-close-modal` closes its dialog. Other `data-*` hooks (`data-open-terms`, `data-open-account`, `data-category`, `data-filter`, `data-show-all`) are wired in JS.
- Checkout requires login (sets `pendingCheckout` and opens the auth modal), writes the order summary to sessionStorage under `iwnz_last_order`, then redirects to `pedido-confirmado.html`, whose inline script reads it. Keep that object's shape (`orderNumber`, `name`, `items`, `total`, `date`) in sync between both files.
- Passwords are "hashed" client-side with `hashPassword` (demo only). User data export/delete (LGPD) lives in section 11.
- Accessibility toggles (contrast, larger font, reduced motion) are applied as classes on the root and persisted in `iwnz_accessibility`.
- Interpolate user/product data into HTML with `escapeHTML`; format money with `formatBRL`.

### Dashboard (`Dashboard/script.js`)

Classic (non-module) script with three layers:

- `CONFIG` — `API_URL` + `ROTAS`. When `API_URL` is empty, `Store.demo` is true and everything runs on localStorage; when set, `Store`/`Auth` call the REST routes instead (Bearer token from the session; a 401 forces logout). Any new data operation should follow this same demo/API branching inside `Store`.
- `Store` / `Auth` — data access and session.
- UI — hash-based view router `go(view)` over sections `#v-dashboard`, `#v-cadastrar`, `#v-listar`; a Produtos/Clientes/Pedidos tab state (`aba`, `setAba`) shared by the Cadastrar and Listar views (Pedidos is list-only). Rendering is via template strings into `innerHTML` — escape values with `esc()` and format money with `brl()`. In demo mode, `Store.vendasSemana()` derives weekly sales, monthly goal and ticket from the store's orders.

## Repository notes

The git repo root is this `E-commerce/` directory. The first commit had the storefront files at the root; they now live in `Loja/`, alongside `Dashboard/` and `Compartilhado/`. Note that `produtos()` only seeds the initial catalog when `loja:v2:produtos` is empty, so catalog changes in `dados.js` only show up after clearing that key.
