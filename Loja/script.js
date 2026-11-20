// =====================================================
// IWNZ Tech — script.js (loja demonstrativa)
// =====================================================

// 1. CONSTANTES E CHAVES DO ARMAZENAMENTO LOCAL
const KEYS = {
  cart: "iwnz_cart",
  user: "iwnz_current_user",
  users: "iwnz_users",
  prefs: "iwnz_accessibility",
  cookies: "iwnz_cookie_consent",
  newsletter: "iwnz_newsletter",
  order: "iwnz_last_order" // lido por pedido-confirmado.html (sessionStorage)
};
const MAX_QTY = 10;          // limite de unidades por produto
const FREE_SHIPPING = 499;   // frete grátis a partir deste valor (ver faixa do topo)
const INSTALLMENTS = 10;     // parcelas sem juros exibidas nos cards
const LOW_STOCK = 3;         // a partir daqui avisa "últimas unidades"
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='#161c2d'/><text x='50%' y='50%' fill='#9aa7b7' font-family='sans-serif' font-size='20' text-anchor='middle'>Imagem indisponível</text></svg>"
);

// 2. CATÁLOGO DE PRODUTOS (compartilhado com o Dashboard)
// Os produtos vêm de ../Compartilhado/dados.js (chave "loja:v2:produtos"),
// então o que for cadastrado no Dashboard aparece aqui.
const DADOS = window.IWNZ_DADOS || null;
if (!DADOS) console.warn("Compartilhado/dados.js não foi carregado: catálogo vazio.");

// Converte o formato do Dashboard (nome, preco…) para o formato da loja
function toStoreProduct(p) {
  const price = Number(p?.preco);
  if (!p || p.id == null || !String(p.nome || "").trim() || !(price >= 0)) return null;
  const oldPrice = Number(p.precoAntigo);
  return {
    id: String(p.id),
    name: String(p.nome).trim(),
    category: String(p.categoria || "Outros"),
    price,
    oldPrice: oldPrice > price ? oldPrice : null,
    rating: Number(p.nota) || null,
    reviews: Number(p.avaliacoes) || 0,
    image: String(p.imagem || "").trim() || FALLBACK_IMG,
    featured: Boolean(p.destaque),
    stock: Math.max(0, Math.floor(Number(p.estoque) || 0)),
    description: String(p.descricao || "")
  };
}

function loadCatalog() {
  return DADOS ? DADOS.produtos().map(toStoreProduct).filter(Boolean) : [];
}

let products = loadCatalog();

// 3. FUNÇÕES AUXILIARES (armazenamento, texto, moeda)
function loadStorage(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function removeStorage(key) {
  try { localStorage.removeItem(key); } catch { /* ignora */ }
}

// Evita injeção de HTML em textos digitados pelo usuário
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function formatBRL(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Remove acentos e maiúsculas (busca tolerante)
function normalizeText(text) {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Mostra/oculta elemento (atributo hidden + style, à prova de CSS que sobrescreve)
function setHidden(el, hidden) {
  if (!el) return;
  el.hidden = hidden;
  el.style.display = hidden ? "none" : "";
}

function prefersReducedMotion() {
  return document.body.classList.contains("reduce-motion") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// Rola suavemente até um elemento (respeita "reduzir animações")
function scrollToEl(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

// 4. TOAST (mensagem flutuante)
// action (opcional): { label, onClick } mostra um botão no toast (ex.: "Desfazer")
let toastTimer = null;
function showToast(text, action = null) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  // Com um modal aberto, o resto da página fica bloqueado para clique;
  // por isso o toast vai para dentro do modal (e volta ao <body> quando ele fecha)
  const host = document.querySelector("dialog[open]") || document.body;
  if (toast.parentElement !== host) host.append(toast);
  toast.textContent = text;
  toast.classList.toggle("has-action", Boolean(action));
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      toast.classList.remove("show");
      action.onClick();
    }, { once: true });
    toast.append(" ", btn);
  }
  toast.classList.add("show");
  clearTimeout(toastTimer);
  // Com botão, fica mais tempo na tela para dar tempo de clicar
  toastTimer = setTimeout(() => toast.classList.remove("show"), action ? 6500 : 3500);
}

// 5. ESTADO GLOBAL DO SITE
let cart = sanitizeCart(loadStorage(KEYS.cart, []));
let currentUser = sanitizeUser(loadStorage(KEYS.user, null));
let authMode = "login";        // "login" ou "register"
let pendingCheckout = false;   // true se o cliente tentou finalizar sem estar logado
let isCheckingOut = false;     // trava contra clique duplo no checkout
const filters = { category: "Todos", query: "", sort: "featured" };

// Quantas unidades do produto o cliente pode levar (limite da loja e estoque)
function maxQtyFor(product) {
  return Math.min(MAX_QTY, product?.stock ?? 0);
}

// Reconstrói o carrinho só com produtos e quantidades válidos (preço e estoque sempre atuais)
function sanitizeCart(raw) {
  if (!Array.isArray(raw)) return [];
  const merged = new Map();
  raw.forEach(entry => {
    const id = String(entry?.id ?? "");
    const qty = Math.floor(Number(entry?.quantity));
    const product = products.find(p => p.id === id);
    if (!product || !(qty > 0)) return;
    merged.set(id, (merged.get(id) || 0) + qty);
  });
  return [...merged]
    .map(([id, quantity]) => {
      const product = products.find(p => p.id === id);
      return { ...product, quantity: Math.min(quantity, maxQtyFor(product)) };
    })
    .filter(item => item.quantity > 0);
}

// Garante que o usuário salvo tem o formato esperado
function sanitizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.name !== "string" || typeof raw.email !== "string" || !raw.email) return null;
  return { name: raw.name, email: raw.email };
}

// 6. CONTROLE DE MODAIS (abrir, fechar, fundo, rolagem)
const authModal = document.querySelector("#authModal");
const cartModal = document.querySelector("#cartModal");
const accessibilityModal = document.querySelector("#accessibilityModal");
const infoModal = document.querySelector("#infoModal");
const allModals = [authModal, cartModal, accessibilityModal, infoModal].filter(Boolean);

// Abre um modal (com alternativa para navegadores sem <dialog>)
function openModal(dlg) {
  if (!dlg || dlg.open) return;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  document.body.classList.add("modal-open");
}

// Trava a rolagem do fundo apenas enquanto houver modal aberto
function syncBodyScroll() {
  document.body.classList.toggle("modal-open", allModals.some(m => m.open));
}

function bindModals() {
  allModals.forEach(dlg => {
    dlg.addEventListener("close", () => {
      syncBodyScroll();
      // Devolve o toast ao <body> para continuar visível depois que o modal fecha
      const toast = document.querySelector("#toast");
      if (toast && dlg.contains(toast)) (document.querySelector("dialog[open]") || document.body).append(toast);
    });
    // Clique fora da caixa (no fundo escuro) fecha o modal
    dlg.addEventListener("click", e => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    });
  });

  // Botões de fechar (X e "Entendi") fecham somente o modal onde estão
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });

  // Se o login for cancelado, descarta a intenção de finalizar compra
  authModal?.addEventListener("close", () => { if (!currentUser) pendingCheckout = false; });
}

// 7. CATÁLOGO: FILTRO, BUSCA, ORDENAÇÃO E RENDERIZAÇÃO
function getVisibleProducts() {
  const q = normalizeText(filters.query);
  const list = products.filter(p => {
    const okCategory = filters.category === "Todos" || p.category === filters.category;
    const okQuery = !q || normalizeText(`${p.name} ${p.category} ${p.description}`).includes(q);
    return okCategory && okQuery;
  });

  switch (filters.sort) {
    case "price-asc": list.sort((a, b) => a.price - b.price); break;
    case "price-desc": list.sort((a, b) => b.price - a.price); break;
    case "name": list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); break;
    // Destaques primeiro; esgotados vão para o fim
    default: list.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt-BR"));
  }
  return list;
}

// Texto do aviso de estoque no card
function stockNoteHTML(p) {
  if (p.stock <= 0) return `<p class="stock-note out">Esgotado no momento</p>`;
  if (p.stock <= LOW_STOCK) return `<p class="stock-note low">Restam só ${p.stock} ${p.stock === 1 ? "unidade" : "unidades"}</p>`;
  return `<p class="stock-note ok">Em estoque</p>`;
}

// Frase que resume o que está sendo exibido (categoria e busca)
function describeResults(count) {
  const parts = [`${count} ${count === 1 ? "produto" : "produtos"}`];
  if (filters.category !== "Todos") parts.push(`em ${filters.category}`);
  if (filters.query.trim()) parts.push(`para “${filters.query.trim()}”`);
  return parts.join(" ");
}

// Desenha os cards de produto na grade
function renderProducts(list = getVisibleProducts()) {
  const grid = document.querySelector("#productGrid");
  const resultsLine = document.querySelector("#resultsLine");
  const emptyState = document.querySelector("#emptyState");
  if (!grid) return;

  if (resultsLine) {
    const filtered = filters.category !== "Todos" || filters.query.trim();
    resultsLine.innerHTML = `Mostrando ${escapeHTML(describeResults(list.length))}` +
      (filtered && list.length ? ` · <button type="button" class="link-button" data-reset-filters>Limpar filtros</button>` : "");
  }
  setHidden(emptyState, list.length > 0);

  grid.innerHTML = list.map(p => {
    const name = escapeHTML(p.name);
    const soldOut = p.stock <= 0;
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `
    <article class="product-card${soldOut ? " sold-out" : ""}">
      <div class="product-image">
        ${discount > 0 ? `<span class="product-tag">-${discount}%</span>` : ""}
        <img src="${escapeHTML(p.image)}" alt="${name}" loading="lazy">
      </div>
      <div class="product-info">
        <span class="product-category">${escapeHTML(p.category)}</span>
        <h3 class="product-title">${name}</h3>
        ${p.rating ? `<div class="rating" aria-label="Nota ${p.rating} de 5, ${p.reviews} avaliações">★ ${p.rating} <span>(${p.reviews})</span></div>` : ""}
        ${p.oldPrice ? `<span class="old-price">${formatBRL(p.oldPrice)}</span>` : ""}
        <div class="price">${formatBRL(p.price)}</div>
        <p class="installments">ou ${INSTALLMENTS}x de ${formatBRL(p.price / INSTALLMENTS)} sem juros</p>
        ${stockNoteHTML(p)}
        <button class="add-cart" type="button" data-id="${escapeHTML(p.id)}" ${soldOut ? "disabled" : ""}
          aria-label="${soldOut ? `${name} esgotado` : `Adicionar ${name} ao carrinho`}">${soldOut ? "Esgotado" : "Adicionar ao carrinho"}</button>
      </div>
    </article>`;
  }).join("");

  // Imagem quebrada vira um quadro cinza em vez de ícone de erro
  grid.querySelectorAll("img").forEach(img => {
    img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true });
  });
}

// Marca o chip de categoria ativo
function syncFilterChips() {
  document.querySelectorAll(".filter-chip").forEach(chip => {
    const active = chip.dataset.filter === filters.category;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
}

function applyFilters() {
  syncFilterChips();
  renderProducts();
}

// Volta busca, categoria e ordenação ao padrão
function resetFilters() {
  filters.category = "Todos";
  filters.query = "";
  filters.sort = "featured";
  const input = document.querySelector("#searchInput");
  const sort = document.querySelector("#sortSelect");
  if (input) input.value = "";
  if (sort) sort.value = "featured";
  applyFilters();
}

function bindCatalog() {
  // Adicionar ao carrinho (um único listener para todos os cards)
  document.querySelector("#productGrid")?.addEventListener("click", e => {
    const btn = e.target.closest(".add-cart");
    if (!btn || btn.disabled) return;
    if (addToCart(btn.dataset.id)) flashAdded(btn);
  });

  // "Limpar filtros" na linha de resultados
  document.querySelector("#resultsLine")?.addEventListener("click", e => {
    if (e.target.closest("[data-reset-filters]")) resetFilters();
  });

  // Atalhos: "/" vai para a busca; Esc dentro da busca limpa o texto
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || document.querySelector("dialog[open]")) return;
    e.preventDefault();
    document.querySelector("#searchInput")?.focus();
  });
  document.querySelector("#searchInput")?.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !e.target.value) return;
    e.target.value = "";
    filters.query = "";
    applyFilters();
  });

  // Chips de categoria
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => { filters.category = chip.dataset.filter; applyFilters(); });
  });

  // Menu de categorias no topo (limpa a busca para não esconder a categoria escolhida)
  document.querySelectorAll(".category-nav [data-category]").forEach(link => {
    link.addEventListener("click", () => {
      filters.category = link.dataset.category;
      filters.query = "";
      const input = document.querySelector("#searchInput");
      if (input) input.value = "";
      applyFilters();
    });
  });

  // "Ver todos os produtos"
  document.querySelector("[data-show-all]")?.addEventListener("click", resetFilters);
  document.querySelector("#clearFilters")?.addEventListener("click", resetFilters);

  // Ordenação
  document.querySelector("#sortSelect")?.addEventListener("change", e => {
    filters.sort = e.target.value;
    applyFilters();
  });

  // Busca (filtra enquanto digita e também ao enviar)
  document.querySelector("#searchInput")?.addEventListener("input", e => {
    filters.query = e.target.value;
    applyFilters();
  });
  document.querySelector("#searchForm")?.addEventListener("submit", e => {
    e.preventDefault();
    filters.query = document.querySelector("#searchInput")?.value || "";
    applyFilters();
    scrollToEl("#produtos");
  });
}

// 8. CARRINHO DE COMPRAS
function persistCart() {
  saveStorage(KEYS.cart, cart.map(i => ({ id: i.id, quantity: i.quantity })));
  updateCartCount();
  renderCart();
}

// Mensagem quando o cliente tenta passar do limite
function limitMessage(product) {
  return product.stock < MAX_QTY
    ? `Só temos ${product.stock} ${product.stock === 1 ? "unidade" : "unidades"} de ${product.name} em estoque.`
    : `Limite de ${MAX_QTY} unidades por produto.`;
}

// Adiciona produto ou soma 1 unidade (respeitando limite e estoque).
// Devolve true se adicionou.
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return false;
  if (product.stock <= 0) {
    showToast(`${product.name} está esgotado.`);
    return false;
  }

  const item = cart.find(i => i.id === productId);
  if (item) {
    if (item.quantity >= maxQtyFor(product)) {
      showToast(limitMessage(product));
      return false;
    }
    item.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  persistCart();
  showToast(`${product.name} adicionado ao carrinho!`, { label: "Ver carrinho", onClick: openCart });
  return true;
}

// Confirmação visual no próprio botão, sem tirar o cliente da página
function flashAdded(btn) {
  const original = btn.textContent;
  btn.classList.add("added");
  btn.textContent = "✓ Adicionado";
  setTimeout(() => {
    if (!btn.isConnected) return;
    btn.classList.remove("added");
    btn.textContent = original;
  }, 1600);
}

// Aumenta (+1) ou diminui (-1) a quantidade; chegando a zero, remove
function changeQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  if (item.quantity + delta <= 0) { removeFromCart(productId); return; }
  const product = products.find(p => p.id === productId) || item;
  if (item.quantity + delta > maxQtyFor(product)) {
    showToast(limitMessage(product));
    return;
  }
  item.quantity += delta;
  persistCart();
}

// Remove o item e oferece "Desfazer" (recupera a mesma posição e quantidade)
function removeFromCart(productId) {
  const index = cart.findIndex(i => i.id === productId);
  if (index < 0) return;
  const [item] = cart.splice(index, 1);
  persistCart();
  showToast(`${item.name} removido do carrinho.`, {
    label: "Desfazer",
    onClick: () => {
      if (cart.some(i => i.id === item.id)) return;
      cart.splice(Math.min(index, cart.length), 0, item);
      cart = sanitizeCart(cart);
      persistCart();
    }
  });
}

function getCartTotals() {
  return {
    items: cart.reduce((acc, i) => acc + i.quantity, 0),
    subtotal: cart.reduce((acc, i) => acc + i.price * i.quantity, 0)
  };
}

// Atualiza o contador do ícone do carrinho (e o rótulo para leitores de tela)
function updateCartCount() {
  const { items } = getCartTotals();
  const countEl = document.querySelector("#cartCount");
  const btn = document.querySelector("#cartOpen");
  if (countEl) countEl.textContent = items;
  if (btn) btn.setAttribute("aria-label", `Abrir carrinho, ${items} ${items === 1 ? "item" : "itens"}`);
}

// Desenha a lista de itens dentro do modal do carrinho
function renderCart() {
  const itemsContainer = document.querySelector("#cartItems");
  const cartEmpty = document.querySelector("#cartEmpty");
  const cartSummary = document.querySelector("#cartSummary");
  const subtotalEl = document.querySelector("#cartSubtotal");
  const titleCount = document.querySelector("#cartTitleCount");
  if (!itemsContainer) return;

  const { items, subtotal } = getCartTotals();
  if (titleCount) titleCount.textContent = `(${items})`;

  const isEmpty = cart.length === 0;
  setHidden(cartEmpty, !isEmpty);
  setHidden(cartSummary, isEmpty);

  itemsContainer.innerHTML = cart.map(item => {
    const name = escapeHTML(item.name);
    const id = escapeHTML(item.id);
    const atMax = item.quantity >= maxQtyFor(item);
    return `
    <div class="cart-line">
      <img src="${escapeHTML(item.image)}" alt="${name}">
      <div>
        <h3>${name}</h3>
        <p>${formatBRL(item.price)} cada</p>
        <div class="quantity-controls">
          <button type="button" data-cart-action="dec" data-id="${id}" aria-label="${item.quantity === 1 ? `Remover ${name}` : `Diminuir quantidade de ${name}`}">−</button>
          <span aria-live="polite" aria-label="Quantidade: ${item.quantity}">${item.quantity}</span>
          <button type="button" data-cart-action="inc" data-id="${id}" aria-label="Aumentar quantidade de ${name}" ${atMax ? "disabled" : ""}>+</button>
        </div>
        ${atMax ? `<small class="cart-limit">Quantidade máxima disponível</small>` : ""}
        <button class="remove-item" type="button" data-cart-action="remove" data-id="${id}" aria-label="Remover ${name} do carrinho">Remover</button>
      </div>
      <strong class="cart-line-total">${formatBRL(item.price * item.quantity)}</strong>
    </div>`;
  }).join("");

  itemsContainer.querySelectorAll("img").forEach(img => {
    img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true });
  });

  if (subtotalEl) subtotalEl.textContent = formatBRL(subtotal);
  renderShippingProgress(subtotal);
}

// Barra "faltam R$ X para frete grátis" no carrinho
function renderShippingProgress(subtotal) {
  const box = document.querySelector("#shippingProgress");
  if (!box) return;
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING) * 100));
  const text = subtotal >= FREE_SHIPPING
    ? "✓ Você ganhou <b>frete grátis</b>!"
    : `Faltam <b>${formatBRL(FREE_SHIPPING - subtotal)}</b> para o frete grátis.`;
  box.classList.toggle("done", subtotal >= FREE_SHIPPING);
  box.innerHTML = `<span>${text}</span>
    <div class="shipping-bar" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`;
}

function openCart() {
  renderCart();
  openModal(cartModal);
}

// Devolve o foco ao teclado depois que a lista é redesenhada
function restoreCartFocus(action, id) {
  const candidates = [
    document.querySelector(`#cartItems [data-cart-action="${action}"][data-id="${id}"]`),
    document.querySelector("#cartItems button"),
    document.querySelector("#continueShopping"),
    cartModal?.querySelector(".modal-close")
  ];
  const target = candidates.find(el => el && !el.disabled && el.offsetParent !== null);
  target?.focus();
}

// Finaliza a compra: exige login, salva o resumo e vai para a confirmação
function checkout() {
  if (isCheckingOut || cart.length === 0) return;

  if (!currentUser) {
    pendingCheckout = true;
    cartModal?.close();
    openAuth("login", "Entre ou crie uma conta para finalizar a compra.");
    return;
  }

  // Confere o estoque mais recente (o Dashboard pode ter alterado em outra aba)
  const before = cart.map(i => `${i.id}:${i.quantity}`).join();
  products = loadCatalog();
  cart = sanitizeCart(cart);
  if (cart.map(i => `${i.id}:${i.quantity}`).join() !== before) {
    persistCart();
    applyFilters();
    showToast("O estoque mudou e ajustamos seu carrinho. Confira antes de finalizar.");
    return;
  }

  isCheckingOut = true;
  const { items, subtotal } = getCartTotals();
  const now = new Date();
  const orderNumber = `IWNZ-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  const order = {
    orderNumber,
    name: escapeHTML(currentUser.name), // a página de confirmação usa innerHTML
    items,
    total: subtotal,
    date: now.toLocaleString("pt-BR")
  };

  try { sessionStorage.setItem(KEYS.order, JSON.stringify(order)); } catch { /* segue mesmo assim */ }
  recordOrderForDashboard(orderNumber, subtotal, now);

  cart = [];
  persistCart();
  showToast("Pedido realizado! Redirecionando…");
  setTimeout(() => window.location.assign("pedido-confirmado.html"), 600);
}

// Registra o pedido para o Dashboard e baixa o estoque dos produtos vendidos
function recordOrderForDashboard(orderNumber, total, date) {
  if (!DADOS) return;
  const orders = DADOS.pedidos();
  orders.push({
    id: orderNumber,
    cliente: { nome: currentUser.name, email: currentUser.email },
    itens: cart.map(i => ({ id: i.id, nome: i.name, preco: i.price, quantidade: i.quantity })),
    total,
    data: date.toISOString(),
    status: "pago" // checkout demonstrativo: todo pedido conta como pago
  });
  DADOS.gravar(DADOS.CHAVES.pedidos, orders);

  const catalog = DADOS.produtos();
  cart.forEach(item => {
    const p = catalog.find(x => String(x.id) === item.id);
    if (p) p.estoque = Math.max(0, (Number(p.estoque) || 0) - item.quantity);
  });
  DADOS.gravar(DADOS.CHAVES.produtos, catalog);
}

function bindCart() {
  // Abre o carrinho
  document.querySelector("#cartOpen")?.addEventListener("click", openCart);

  // Botões + / − / Remover (delegação de eventos)
  document.querySelector("#cartItems")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-cart-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.cartAction;
    if (action === "inc") changeQuantity(id, 1);
    else if (action === "dec") changeQuantity(id, -1);
    else if (action === "remove") removeFromCart(id);
    restoreCartFocus(action, id);
  });

  // Continuar comprando: fecha o carrinho e leva aos produtos
  document.querySelector("#continueShopping")?.addEventListener("click", () => {
    cartModal?.close();
    scrollToEl("#produtos");
  });

  document.querySelector("#checkoutButton")?.addEventListener("click", checkout);

  // Voltando pelo histórico (cache), libera o checkout e relê o carrinho
  window.addEventListener("pageshow", e => {
    if (!e.persisted) return;
    isCheckingOut = false;
    products = loadCatalog();
    applyFilters();
    cart = sanitizeCart(loadStorage(KEYS.cart, []));
    updateCartCount();
    renderCart();
  });
}

// 9. CONTA: CADASTRO, LOGIN E SAÍDA
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const nameField = document.querySelector("#nameField");
const registerConsents = document.querySelector("#registerConsents");
const authSubmit = document.querySelector("#authSubmit");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const accountLabel = document.querySelector("#accountLabel");
const authTitle = document.querySelector("#authTitle");
const authIntro = document.querySelector("#authIntro");
const authEyebrow = authModal?.querySelector(".eyebrow");
const authTabsBar = authModal?.querySelector(".auth-tabs");
const authSecurityNote = authModal?.querySelector(".security-note");
let accountPanel = null; // painel "conta conectada", criado sob demanda

// Hash simples da senha (apenas demonstrativo — um site real faria isso no servidor)
function hashPassword(email, password) {
  const str = `iwnz|${email}|${password}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "h1$" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function getUsers() {
  const users = loadStorage(KEYS.users, []);
  return Array.isArray(users) ? users : [];
}

function setAuthMessage(text) {
  if (authMessage) authMessage.textContent = text || "";
}

// Alterna entre as abas "Entrar" e "Criar conta"
function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  const isRegister = authMode === "register";

  loginTab?.classList.toggle("active", !isRegister);
  registerTab?.classList.toggle("active", isRegister);
  loginTab?.setAttribute("aria-selected", String(!isRegister));
  registerTab?.setAttribute("aria-selected", String(isRegister));
  loginTab && (loginTab.tabIndex = isRegister ? -1 : 0);
  registerTab && (registerTab.tabIndex = isRegister ? 0 : -1);

  setHidden(nameField, !isRegister);
  setHidden(registerConsents, !isRegister);
  const nameInput = document.querySelector("#fullName");
  if (nameInput) nameInput.required = isRegister;
  document.querySelector("#authPassword")?.setAttribute("autocomplete", isRegister ? "new-password" : "current-password");

  if (authSubmit) authSubmit.innerHTML = isRegister ? "Criar minha conta <span>→</span>" : "Entrar na minha conta <span>→</span>";
  if (authTitle) authTitle.textContent = isRegister ? "Crie sua conta." : "Entre para continuar.";
  if (authIntro) authIntro.textContent = isRegister ? "Preencha os dados e aceite os termos para se cadastrar." : "Acesse sua conta ou crie uma nova.";
  setAuthMessage("");
}

// Cria o painel de conta conectada (nome, e-mail, sair, privacidade)
function ensureAccountPanel() {
  if (accountPanel || !authModal) return accountPanel;
  accountPanel = document.createElement("div");
  accountPanel.id = "accountPanel";
  accountPanel.innerHTML = `
    <p class="modal-intro" id="accountInfo"></p>
    <button class="button button-primary full-button" type="button" id="logoutButton">Sair da conta</button>
    <button class="button button-secondary full-button" type="button" id="accountPrivacyButton" style="margin-top:10px">Privacidade e meus dados</button>
  `;
  (authTabsBar || authForm).before(accountPanel);
  accountPanel.querySelector("#logoutButton").addEventListener("click", logout);
  accountPanel.querySelector("#accountPrivacyButton").addEventListener("click", () => openInfo("terms"));
  return accountPanel;
}

// Mostra o formulário (visitante) ou o painel de conta (logado)
function renderAuthView() {
  if (!authModal) return;
  const logged = Boolean(currentUser);
  const panel = ensureAccountPanel();

  setHidden(panel, !logged);
  setHidden(authTabsBar, logged);
  setHidden(authForm, logged);
  setHidden(authSecurityNote, logged);

  if (logged) {
    if (authEyebrow) authEyebrow.textContent = "MINHA CONTA";
    if (authTitle) authTitle.textContent = `Olá, ${currentUser.name.split(" ")[0]}!`;
    if (authIntro) authIntro.textContent = "Você está conectado(a) neste navegador.";
    panel.querySelector("#accountInfo").textContent = currentUser.email;
  } else {
    if (authEyebrow) authEyebrow.textContent = "BEM-VINDO À IWNZ";
    setAuthMode(authMode);
  }
}

// Abre o modal de conta, já no modo e com a mensagem desejados
function openAuth(mode = "login", message = "") {
  cartModal?.close();
  renderAuthView();
  if (!currentUser) {
    setAuthMode(mode);
    setAuthMessage(message);
  }
  openModal(authModal);
}

// Atualiza o botão da conta no cabeçalho
function updateAuthUI() {
  const first = currentUser ? currentUser.name.trim().split(/\s+/)[0] : "";
  if (accountLabel) accountLabel.textContent = first || "Entrar";
  document.querySelector("#accountOpen")?.setAttribute("aria-label", currentUser ? `Minha conta: ${first}` : "Entrar ou cadastrar");
  renderAuthView();
}

// Conclui o login/cadastro: fecha o modal e retoma o checkout, se houver
function finishAuth(toastText) {
  const resume = pendingCheckout;
  pendingCheckout = false;
  authForm?.reset();
  updateAuthUI();
  authModal?.close();
  if (resume && cart.length > 0) {
    renderCart();
    openModal(cartModal);
    showToast("Tudo certo! Agora é só finalizar a compra.");
  } else {
    showToast(toastText);
  }
}

// Cria o cliente na lista do Dashboard (sem senha: o painel só precisa do contato)
function registerClientForDashboard(name, email, createdAt) {
  if (!DADOS) return;
  const clients = DADOS.clientes();
  if (clients.some(c => String(c.email).toLowerCase() === email)) return;
  clients.push({ id: "c" + Date.now(), nome: name, email, telefone: "", cpf: "", cidade: "", endereco: "", criadoEm: createdAt, origem: "loja" });
  DADOS.gravar(DADOS.CHAVES.clientes, clients);
}

// Valida e processa o cadastro
function handleRegister(name, email, password) {
  if (name.length < 2) return setAuthMessage("Informe seu nome completo.");
  const acceptedTerms = document.querySelector("#termsConsent")?.checked;
  const acceptedPrivacy = document.querySelector("#privacyConsent")?.checked;
  if (!acceptedTerms || !acceptedPrivacy) {
    return setAuthMessage("Você deve aceitar os Termos de Uso e a Política de Privacidade para continuar.");
  }

  const users = getUsers();
  if (users.some(u => u.email === email)) return setAuthMessage("Este e-mail já está cadastrado. Use a aba Entrar.");

  const now = new Date().toISOString();
  users.push({
    name: name.slice(0, 80),
    email,
    passwordHash: hashPassword(email, password),
    registeredAt: now,
    consent: { terms: true, privacy: true, at: now } // registro do consentimento (LGPD)
  });
  if (!saveStorage(KEYS.users, users)) return setAuthMessage("Não foi possível salvar seus dados. Verifique se o navegador permite armazenamento.");
  registerClientForDashboard(name.slice(0, 80), email, now);

  currentUser = { name: name.slice(0, 80), email };
  saveStorage(KEYS.user, currentUser);
  finishAuth("Conta criada com sucesso!");
}

// Valida e processa o login
function handleLogin(email, password) {
  const users = getUsers();
  const user = users.find(u =>
    u.email === email && (u.passwordHash === hashPassword(email, password) || (u.password !== undefined && u.password === password))
  );
  if (!user) return setAuthMessage("E-mail ou senha incorretos. Verifique os dados ou crie uma conta.");

  // Migra contas antigas que guardavam a senha em texto puro
  if (user.password !== undefined) {
    user.passwordHash = hashPassword(email, password);
    delete user.password;
    saveStorage(KEYS.users, users);
  }

  // Se o painel tiver removido o cliente da lista, ele volta a aparecer ao entrar
  registerClientForDashboard(user.name, user.email, user.registeredAt || new Date().toISOString());

  currentUser = { name: user.name, email: user.email };
  saveStorage(KEYS.user, currentUser);
  finishAuth(`Bem-vindo(a) de volta, ${currentUser.name.split(" ")[0]}!`);
}

function logout() {
  currentUser = null;
  pendingCheckout = false;
  removeStorage(KEYS.user);
  updateAuthUI();
  authModal?.close();
  showToast("Você saiu da conta.");
}

function bindAuth() {
  if (authForm) authForm.noValidate = true; // as mensagens são nossas, em português

  // Botão de conta no cabeçalho e links "Minha conta"
  document.querySelector("#accountOpen")?.addEventListener("click", () => openAuth("login"));
  document.addEventListener("click", e => {
    const link = e.target.closest("[data-open-account]");
    if (!link) return;
    e.preventDefault();
    openAuth("login");
  });

  // Abas (clique e setas do teclado)
  loginTab?.addEventListener("click", () => setAuthMode("login"));
  registerTab?.addEventListener("click", () => setAuthMode("register"));
  [loginTab, registerTab].forEach(tab => {
    tab?.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const next = (e.key === "ArrowLeft" || e.key === "Home") ? loginTab : registerTab;
      setAuthMode(next === registerTab ? "register" : "login");
      next.focus();
    });
  });

  // Envio do formulário
  authForm?.addEventListener("submit", e => {
    e.preventDefault();
    const name = (document.querySelector("#fullName")?.value || "").trim().replace(/\s+/g, " ");
    const email = (document.querySelector("#authEmail")?.value || "").trim().toLowerCase();
    const password = document.querySelector("#authPassword")?.value || "";
    setAuthMessage("");

    if (!EMAIL_REGEX.test(email)) return setAuthMessage("Atenção: insira um endereço de e-mail válido (exemplo: nome@dominio.com).");
    if (password.length < 6) return setAuthMessage("A senha deve ter no mínimo 6 caracteres!");

    if (authMode === "register") handleRegister(name, email, password);
    else handleLogin(email, password);
  });
}

// 10. ACESSIBILIDADE (contraste, texto maior, menos animação)
const A11Y_OPTIONS = {
  contrast: { button: "#contrastToggle", className: "high-contrast" },
  font: { button: "#fontToggle", className: "large-text" },
  motion: { button: "#motionToggle", className: "reduce-motion" }
};
let a11yPrefs = { contrast: false, font: false, motion: false };

// Lê preferências salvas (se nunca configurou, respeita o "reduzir movimento" do sistema)
function loadAccessibilityPrefs() {
  const saved = loadStorage(KEYS.prefs, null);
  if (saved && typeof saved === "object") {
    Object.keys(a11yPrefs).forEach(k => { a11yPrefs[k] = saved[k] === true; });
  } else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    a11yPrefs.motion = true;
  }
}

// Aplica as classes no <body> e atualiza os botões (aria-pressed + texto)
function applyAccessibilityPrefs() {
  Object.entries(A11Y_OPTIONS).forEach(([key, opt]) => {
    const on = a11yPrefs[key];
    document.body.classList.toggle(opt.className, on);
    const btn = document.querySelector(opt.button);
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Ativado" : "Desativado";
    }
  });
}

function bindAccessibility() {
  document.querySelector("#accessibilityOpen")?.addEventListener("click", () => openModal(accessibilityModal));

  Object.entries(A11Y_OPTIONS).forEach(([key, opt]) => {
    document.querySelector(opt.button)?.addEventListener("click", () => {
      a11yPrefs[key] = !a11yPrefs[key];
      saveStorage(KEYS.prefs, a11yPrefs);
      applyAccessibilityPrefs();
    });
  });

  document.querySelector("#resetAccessibility")?.addEventListener("click", () => {
    a11yPrefs = { contrast: false, font: false, motion: false };
    saveStorage(KEYS.prefs, a11yPrefs);
    applyAccessibilityPrefs();
    showToast("Acessibilidade restaurada ao padrão.");
  });
}

// 11. TERMOS, PRIVACIDADE (LGPD) E CONTATO
// Texto dos termos e da política de privacidade (Lei nº 13.709/2018)
function buildTermsHTML() {
  const rights = currentUser ? `
    <h3>Exercer seus direitos agora</h3>
    <p>Como você está conectado(a), pode usar os botões abaixo:</p>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin:10px 0 18px">
      <button class="button button-secondary" type="button" data-lgpd-action="export">Baixar meus dados</button>
      <button class="button button-secondary" type="button" data-lgpd-action="delete">Excluir minha conta e dados</button>
    </div>` : `
    <h3>Exercer seus direitos</h3>
    <p>Entre na sua conta para baixar ou excluir seus dados diretamente por aqui.</p>`;

  return `
    <p><em>Projeto acadêmico demonstrativo. Nenhuma compra, cobrança ou envio é real.</em></p>
    <p>Este texto segue a Lei Geral de Proteção de Dados Pessoais (LGPD), Lei nº 13.709/2018.</p>

    <h3>1. Quem somos</h3>
    <p>A IWNZ Tech é uma loja fictícia criada para fins de aprendizado. Para a LGPD, a controladora dos dados é a equipe do projeto.</p>

    <h3>2. Quais dados tratamos</h3>
    <ul>
      <li>Cadastro: nome, e-mail e senha (guardada de forma codificada).</li>
      <li>Compra: itens do carrinho e pedidos simulados (para o painel da loja).</li>
      <li>Preferências: acessibilidade e escolha de cookies.</li>
      <li>Newsletter: e-mail, se você se inscrever.</li>
    </ul>

    <h3>3. Para que usamos</h3>
    <ul>
      <li>Criar e manter sua conta neste protótipo.</li>
      <li>Lembrar seu carrinho e simular a finalização da compra.</li>
      <li>Aplicar suas preferências de acessibilidade.</li>
      <li>Enviar novidades, somente se você se inscrever.</li>
    </ul>

    <h3>4. Base legal</h3>
    <p>Consentimento do titular (art. 7º, I) e procedimentos preliminares ao contrato, como o pedido simulado (art. 7º, V). Ao criar a conta, registramos a data e hora do seu aceite.</p>

    <h3>5. Armazenamento e compartilhamento</h3>
    <p>Todos os dados ficam apenas no seu navegador (localStorage e sessionStorage). Não há servidor, e não compartilhamos dados com terceiros. Seu nome, e-mail e pedidos ficam visíveis no painel administrativo da própria loja (Dashboard), aberto no mesmo navegador. Limpar os dados do navegador também apaga tudo.</p>

    <h3>6. Seus direitos (art. 18 da LGPD)</h3>
    <ul>
      <li>Confirmar a existência de tratamento e acessar seus dados.</li>
      <li>Corrigir dados incompletos ou desatualizados.</li>
      <li>Pedir anonimização, bloqueio ou eliminação.</li>
      <li>Solicitar portabilidade dos dados.</li>
      <li>Revogar o consentimento a qualquer momento.</li>
      <li>Ser informado(a) sobre com quem os dados são compartilhados.</li>
    </ul>
    ${rights}

    <h3>7. Cookies e armazenamento</h3>
    <p>Usamos apenas armazenamento essencial para carrinho, conta e preferências. Você pode rever sua escolha em "Preferências de cookies", no rodapé.</p>

    <h3>8. Termos de uso</h3>
    <ul>
      <li>Preços, estoque e produtos são ilustrativos.</li>
      <li>Nenhum pagamento é processado e nenhum produto é entregue.</li>
      <li>Você é responsável por manter sua senha em sigilo.</li>
    </ul>

    <h3>9. Contato do encarregado (DPO)</h3>
    <p>privacidade@iwnz.tech (endereço fictício, para fins demonstrativos).</p>
  `;
}

function buildContactHTML() {
  return `
    <p><em>Canais fictícios, para fins demonstrativos.</em></p>
    <h3>E-mail</h3>
    <p>contato@iwnz.tech</p>
    <h3>Atendimento</h3>
    <p>Segunda a sexta, das 9h às 18h.</p>
    <h3>Privacidade</h3>
    <p>Dúvidas sobre seus dados: privacidade@iwnz.tech.</p>
  `;
}

// Abre o modal de informação com o conteúdo pedido ("terms" ou "contact")
function openInfo(type) {
  const title = document.querySelector("#infoTitle");
  const content = document.querySelector("#infoContent");
  if (!infoModal || !content) return;
  if (title) title.textContent = type === "contact" ? "Fale conosco" : "Privacidade e termos";
  content.innerHTML = type === "contact" ? buildContactHTML() : buildTermsHTML();
  content.scrollTop = 0;
  openModal(infoModal);
}

// LGPD: baixa um arquivo JSON com tudo o que guardamos sobre o usuário
function exportUserData() {
  if (!currentUser) return;
  const record = getUsers().find(u => u.email === currentUser.email);
  const data = {
    conta: record ? { nome: record.name, email: record.email, cadastradoEm: record.registeredAt, consentimento: record.consent || null } : currentUser,
    carrinho: cart.map(i => ({ produto: i.name, quantidade: i.quantity })),
    pedidos: DADOS ? DADOS.pedidos().filter(o => o.cliente?.email === currentUser.email) : [],
    newsletter: (loadStorage(KEYS.newsletter, []) || []).some(n => n.email === currentUser.email),
    preferenciasAcessibilidade: a11yPrefs,
    exportadoEm: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meus-dados-iwnz.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Seus dados foram baixados.");
}

// LGPD: elimina conta, sessão, carrinho e inscrição na newsletter
function deleteUserData() {
  if (!currentUser) return;
  if (!window.confirm("Excluir sua conta e todos os seus dados deste navegador? Esta ação não pode ser desfeita.")) return;

  const email = currentUser.email;
  saveStorage(KEYS.users, getUsers().filter(u => u.email !== email));
  const subs = loadStorage(KEYS.newsletter, []);
  saveStorage(KEYS.newsletter, (Array.isArray(subs) ? subs : []).filter(n => n.email !== email));
  if (DADOS) {
    // Remove o cadastro do painel e anonimiza os pedidos (o valor vendido continua nos relatórios)
    DADOS.gravar(DADOS.CHAVES.clientes, DADOS.clientes().filter(c => String(c.email).toLowerCase() !== email));
    DADOS.gravar(DADOS.CHAVES.pedidos, DADOS.pedidos().map(o =>
      o.cliente?.email === email ? { ...o, cliente: { nome: "Cliente removido", email: "" } } : o
    ));
  }
  removeStorage(KEYS.user);
  removeStorage(KEYS.cart);
  currentUser = null;
  cart = [];
  pendingCheckout = false;
  updateCartCount();
  renderCart();
  updateAuthUI();
  infoModal?.close();
  authModal?.close();
  showToast("Sua conta e seus dados foram excluídos.");
}

function bindLegal() {
  // Qualquer link "Termos / Privacidade" abre o modal (mesmo dentro do cadastro)
  document.addEventListener("click", e => {
    const link = e.target.closest("[data-open-terms]");
    if (!link) return;
    e.preventDefault();
    openInfo("terms");
  });

  document.querySelector("#footerContact")?.addEventListener("click", e => {
    e.preventDefault();
    openInfo("contact");
  });

  // Botões de direitos do titular dentro do texto
  document.querySelector("#infoContent")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-lgpd-action]");
    if (!btn) return;
    if (btn.dataset.lgpdAction === "export") exportUserData();
    if (btn.dataset.lgpdAction === "delete") deleteUserData();
  });
}

// 12. BANNER DE COOKIES
const cookieBanner = document.querySelector("#cookieBanner");

function saveCookieChoice(choice) {
  saveStorage(KEYS.cookies, { choice, at: new Date().toISOString() });
  setHidden(cookieBanner, true);
  showToast(choice === "all" ? "Preferência salva: todos os cookies." : "Preferência salva: apenas essenciais.");
}

function bindCookies() {
  // Mostra o banner somente se ainda não houve escolha
  const saved = loadStorage(KEYS.cookies, null);
  setHidden(cookieBanner, Boolean(saved && saved.choice));

  document.querySelector("#essentialCookies")?.addEventListener("click", () => saveCookieChoice("essential"));
  document.querySelector("#acceptCookies")?.addEventListener("click", () => saveCookieChoice("all"));

  // Rodapé: reabre o banner para o usuário mudar a escolha
  document.querySelector("#footerCookies")?.addEventListener("click", e => {
    e.preventDefault();
    setHidden(cookieBanner, false);
    document.querySelector("#essentialCookies")?.focus();
  });
}

// 13. NEWSLETTER
function bindNewsletter() {
  document.querySelector("#newsletterForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const input = document.querySelector("#newsletterEmail");
    const email = (input?.value || "").trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      showToast("Digite um e-mail válido para se inscrever.");
      input?.focus();
      return;
    }

    const raw = loadStorage(KEYS.newsletter, []);
    const subs = Array.isArray(raw) ? raw : [];
    if (subs.some(n => n.email === email)) {
      showToast("Este e-mail já está inscrito na newsletter.");
      return;
    }

    subs.push({ email, at: new Date().toISOString() });
    saveStorage(KEYS.newsletter, subs);
    e.target.reset();
    showToast("Inscrição feita! Você receberá nossas novidades.");
  });
}

// 14. SINCRONIZAÇÃO ENTRE ABAS DO NAVEGADOR
window.addEventListener("storage", e => {
  // Produto cadastrado/editado no Dashboard (ou estoque baixado por outra aba)
  if (DADOS && e.key === DADOS.CHAVES.produtos) {
    products = loadCatalog();
    cart = sanitizeCart(cart);
    applyFilters();
    updateCartCount();
    renderCart();
  }
  if (e.key === KEYS.cart) {
    cart = sanitizeCart(loadStorage(KEYS.cart, []));
    updateCartCount();
    renderCart();
  }
  if (e.key === KEYS.user) {
    currentUser = sanitizeUser(loadStorage(KEYS.user, null));
    updateAuthUI();
  }
});

// 15. INICIALIZAÇÃO DA PÁGINA
function init() {
  loadAccessibilityPrefs();
  applyAccessibilityPrefs();
  bindModals();
  bindCatalog();
  bindCart();
  bindAuth();
  bindAccessibility();
  bindLegal();
  bindCookies();
  bindNewsletter();

  applyFilters();
  updateCartCount();
  renderCart();
  updateAuthUI();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();