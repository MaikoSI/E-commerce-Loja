/* =========================================================
   IWNZ TECH — SCRIPT.JS
   Lógica da loja virtual para fins acadêmicos.
   ========================================================= */

/* 1. Funções auxiliares para salvar e recuperar informações. */

// Salva dados no armazenamento local do navegador.
function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Não foi possível salvar os dados:", error);
  }
}

// Recupera os dados salvos ou devolve um valor padrão.
function loadStorage(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data === null ? fallback : JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

// Formata números como valores monetários brasileiros.
function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

// Mostra uma mensagem temporária na tela.
let toastTimer;

function showToast(message) {
  const toast = document.querySelector("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* 2. Lista de produtos.
   Cada objeto representa um produto do catálogo. */

const products = [
  {
    id: 1,
    name: "Placa de vídeo GeForce RTX",
    category: "Hardware",
    price: 2499.90,
    oldPrice: 2899.90,
    rating: 4.9,
    tag: "OFERTA",
    image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 2,
    name: "Teclado mecânico RGB",
    category: "Periféricos",
    price: 289.90,
    oldPrice: 359.90,
    rating: 4.8,
    tag: "MAIS VENDIDO",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 3,
    name: "Mouse gamer de alta precisão",
    category: "Periféricos",
    price: 159.90,
    oldPrice: 199.90,
    rating: 4.7,
    tag: "OFERTA",
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 4,
    name: "Monitor gamer de alta definição",
    category: "Monitores",
    price: 1199.90,
    oldPrice: 1399.90,
    rating: 4.9,
    tag: "DESTAQUE",
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 5,
    name: "Headset gamer com microfone",
    category: "Periféricos",
    price: 249.90,
    oldPrice: 299.90,
    rating: 4.6,
    tag: "OFERTA",
    image: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 6,
    name: "Memória RAM para computador",
    category: "Hardware",
    price: 349.90,
    oldPrice: 399.90,
    rating: 4.8,
    tag: "UPGRADE",
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 7,
    name: "Gabinete gamer com iluminação",
    category: "Hardware",
    price: 499.90,
    oldPrice: 599.90,
    rating: 4.7,
    tag: "DESTAQUE",
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=700&q=80"
  },
  {
    id: 8,
    name: "Mousepad para setup",
    category: "Acessórios",
    price: 79.90,
    oldPrice: 99.90,
    rating: 4.5,
    tag: "OFERTA",
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=700&q=80"
  }
];

/* 3. Variáveis que guardam o estado atual da loja. */

// Categoria escolhida pelo cliente.
let activeCategory = "Todos";

// Texto digitado na pesquisa.
let searchTerm = "";

// Produtos presentes no carrinho.
let cart = loadStorage("iwnz_cart", []);

// Produtos marcados como favoritos.
let favorites = loadStorage("iwnz_favorites", []);

// Usuário conectado no protótipo.
let currentUser = loadStorage("iwnz_current_user", null);

// Define se o formulário está no login ou no cadastro.
let authMode = "login";

// Guarda se a autenticação foi solicitada durante o checkout.
let checkoutPending = false;

/* 4. Renderização dos produtos.
   Renderizar significa construir e atualizar os elementos da tela. */

function renderProducts() {
  const grid = document.querySelector("#productGrid");
  const emptyState = document.querySelector("#emptyState");
  const resultsLine = document.querySelector("#resultsLine");
  const sortSelect = document.querySelector("#sortSelect");

  // Filtra a lista pela categoria selecionada.
  let filtered = products.filter(product => {
    const matchesCategory =
      activeCategory === "Todos" ||
      product.category === activeCategory;

    // A pesquisa considera nome e categoria.
    const text = `${product.name} ${product.category}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Ordena a lista conforme a opção selecionada.
  if (sortSelect.value === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortSelect.value === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortSelect.value === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  // Informa quantos produtos foram encontrados.
  resultsLine.textContent = `${filtered.length} produto(s) encontrado(s)`;

  // Mostra uma mensagem se a pesquisa não encontrar produtos.
  emptyState.hidden = filtered.length > 0;

  // Cria os cartões de produtos.
  grid.innerHTML = filtered.map(product => {
    const discount = Math.round(
      (1 - product.price / product.oldPrice) * 100
    );

    const isFavorite = favorites.includes(product.id);

    return `
      <article class="product-card">
        <div class="product-image">
          <img
            src="${product.image}"
            alt="${product.name}"
            loading="lazy">

          <span class="product-tag">${product.tag}</span>

          <button
            class="favorite-button"
            type="button"
            data-favorite="${product.id}"
            aria-label="Favoritar ${product.name}"
            aria-pressed="${isFavorite}">
            ${isFavorite ? "♥" : "♡"}
          </button>
        </div>

        <div class="product-info">
          <span class="product-category">${product.category}</span>

          <h3 class="product-title">${product.name}</h3>

          <div class="rating">
            ★★★★★ <span>${product.rating.toFixed(1)} / 5</span>
          </div>

          <div>
            <span class="old-price">${formatPrice(product.oldPrice)}</span>
            <span class="discount">${discount}% OFF</span>
          </div>

          <p class="price">${formatPrice(product.price)}</p>

          <p class="installments">
            ou 10x de ${formatPrice(product.price / 10)}
          </p>

          <button
            class="add-cart"
            type="button"
            data-add-cart="${product.id}">
            Adicionar ao carrinho +
          </button>
        </div>
      </article>
    `;
  }).join("");
}

/* 5. Eventos do catálogo.
   Eventos detectam ações feitas pelo usuário. */

// Pesquisa enviada pelo formulário.
document.querySelector("#searchForm").addEventListener("submit", event => {
  event.preventDefault();

  searchTerm = document.querySelector("#searchInput").value.trim();

  renderProducts();

  document.querySelector("#produtos").scrollIntoView({
    behavior: "smooth"
  });
});

// Atualiza a busca enquanto o usuário digita.
document.querySelector("#searchInput").addEventListener("input", event => {
  searchTerm = event.target.value.trim();
  renderProducts();
});

// Ordenação por preço ou nome.
document.querySelector("#sortSelect").addEventListener("change", renderProducts);

// Filtros de categoria.
document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.filter;

    // Atualiza o destaque visual do filtro selecionado.
    document.querySelectorAll("[data-filter]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderProducts();
  });
});

// Categorias da navegação superior.
document.querySelectorAll("[data-category]").forEach(link => {
  link.addEventListener("click", () => {
    activeCategory = link.dataset.category;

    document.querySelectorAll("[data-filter]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === activeCategory
      );
    });

    renderProducts();
  });
});

// O link "Ver todos os produtos" remove o filtro.
document.querySelector("[data-show-all]").addEventListener("click", () => {
  activeCategory = "Todos";
  searchTerm = "";
  document.querySelector("#searchInput").value = "";

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === "Todos");
  });

  renderProducts();
});

// Botão para limpar os filtros quando nada for encontrado.
document.querySelector("#clearFilters").addEventListener("click", () => {
  activeCategory = "Todos";
  searchTerm = "";
  document.querySelector("#searchInput").value = "";

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === "Todos");
  });

  renderProducts();
});

/* 6. Favoritos.
   Os favoritos são salvos no navegador. */

document.querySelector("#productGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-favorite]");

  if (!button) return;

  const id = Number(button.dataset.favorite);

  if (favorites.includes(id)) {
    favorites = favorites.filter(item => item !== id);
    showToast("Produto removido dos favoritos.");
  } else {
    favorites.push(id);
    showToast("Produto adicionado aos favoritos.");
  }

  saveStorage("iwnz_favorites", favorites);
  renderProducts();
});

/* 7. Carrinho de compras. */

// Adiciona um produto ao carrinho.
function addToCart(productId) {
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: productId,
      quantity: 1
    });
  }

  saveStorage("iwnz_cart", cart);
  renderCart();

  const product = products.find(item => item.id === productId);
  showToast(`${product.name} adicionado ao carrinho.`);
}

// Escuta os cliques nos botões de adicionar.
document.querySelector("#productGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-add-cart]");

  if (!button) return;

  addToCart(Number(button.dataset.addCart));
});

// Calcula o número total de unidades no carrinho.
function getCartCount() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

// Calcula o valor total dos produtos.
function getCartTotal() {
  return cart.reduce((total, item) => {
    const product = products.find(product => product.id === item.id);

    return total + (product ? product.price * item.quantity : 0);
  }, 0);
}

// Atualiza o conteúdo visual do carrinho.
function renderCart() {
  const cartItems = document.querySelector("#cartItems");
  const cartEmpty = document.querySelector("#cartEmpty");
  const cartSummary = document.querySelector("#cartSummary");

  // Atualiza os contadores do cabeçalho e do modal.
  document.querySelector("#cartCount").textContent = getCartCount();
  document.querySelector("#cartTitleCount").textContent = `(${getCartCount()})`;

  // Exibe ou esconde a mensagem de carrinho vazio.
  cartEmpty.hidden = cart.length > 0;
  cartSummary.hidden = cart.length === 0;

  // Cria as linhas de produtos no carrinho.
  cartItems.innerHTML = cart.map(item => {
    const product = products.find(product => product.id === item.id);

    if (!product) return "";

    return `
      <div class="cart-line">
        <img src="${product.image}" alt="${product.name}">

        <div>
          <h3>${product.name}</h3>
          <p>${formatPrice(product.price)}</p>

          <div class="quantity-controls">
            <button
              type="button"
              data-quantity="${product.id}"
              data-change="-1"
              aria-label="Diminuir quantidade">−</button>

            <span>${item.quantity}</span>

            <button
              type="button"
              data-quantity="${product.id}"
              data-change="1"
              aria-label="Aumentar quantidade">+</button>
          </div>

          <button
            class="remove-item"
            type="button"
            data-remove="${product.id}">
            Remover
          </button>
        </div>

        <strong class="cart-line-total">
          ${formatPrice(product.price * item.quantity)}
        </strong>
      </div>
    `;
  }).join("");

  document.querySelector("#cartSubtotal").textContent =
    formatPrice(getCartTotal());
}

// Atualiza quantidades e remove itens usando os botões do carrinho.
document.querySelector("#cartItems").addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");

  if (quantityButton) {
    const id = Number(quantityButton.dataset.quantity);
    const change = Number(quantityButton.dataset.change);
    const item = cart.find(item => item.id === id);

    if (item) {
      item.quantity += change;

      // Remove o produto se a quantidade chegar a zero.
      if (item.quantity <= 0) {
        cart = cart.filter(item => item.id !== id);
      }
    }

    saveStorage("iwnz_cart", cart);
    renderCart();
  }

  if (removeButton) {
    const id = Number(removeButton.dataset.remove);

    cart = cart.filter(item => item.id !== id);

    saveStorage("iwnz_cart", cart);
    renderCart();

    showToast("Produto removido do carrinho.");
  }
});

/* 8. Controle dos modais.
   Os modais são janelas abertas sobre a página. */

const authModal = document.querySelector("#authModal");
const cartModal = document.querySelector("#cartModal");
const accessibilityModal = document.querySelector("#accessibilityModal");
const infoModal = document.querySelector("#infoModal");

// Abre uma janela modal e bloqueia a rolagem de fundo.
function openModal(modal) {
  if (!modal.open) {
    modal.showModal();
  }

  document.body.classList.add("modal-open");
}

// Fecha uma janela modal.
function closeModal(modal) {
  if (modal.open) {
    modal.close();
  }

  if (![authModal, cartModal, accessibilityModal, infoModal]
      .some(item => item.open)) {
    document.body.classList.remove("modal-open");
  }
}

// Fecha modais usando os botões com o atributo data-close-modal.
document.querySelectorAll("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => {
    const modal = button.closest("dialog");
    closeModal(modal);
  });
});

// Também fecha a janela ao clicar fora de seu conteúdo.
[authModal, cartModal, accessibilityModal, infoModal].forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  modal.addEventListener("close", () => {
    if (![authModal, cartModal, accessibilityModal, infoModal]
        .some(item => item.open)) {
      document.body.classList.remove("modal-open");
    }
  });
});

// Botão do carrinho no cabeçalho.
document.querySelector("#cartOpen").addEventListener("click", () => {
  renderCart();
  openModal(cartModal);
});

// Fecha o carrinho e leva o usuário de volta aos produtos.
document.querySelector("#continueShopping").addEventListener("click", () => {
  closeModal(cartModal);

  document.querySelector("#produtos").scrollIntoView({
    behavior: "smooth"
  });
});

/* 9. Login e cadastro demonstrativos. */

// Alterna o formulário entre entrar e criar conta.
function setAuthMode(mode) {
  authMode = mode;

  const registering = mode === "register";

  document.querySelector("#nameField").hidden = !registering;
  document.querySelector("#registerConsents").hidden = !registering;

  document.querySelector("#fullName").required = registering;

  document.querySelector("#termsConsent").required = registering;
  document.querySelector("#privacyConsent").required = registering;

  document.querySelector("#loginTab").classList.toggle("active", !registering);
  document.querySelector("#registerTab").classList.toggle("active", registering);

  document.querySelector("#loginTab").setAttribute(
    "aria-selected", String(!registering)
  );

  document.querySelector("#registerTab").setAttribute(
    "aria-selected", String(registering)
  );

  document.querySelector("#authTitle").textContent = registering
    ? "Crie sua conta."
    : "Entre para continuar.";

  document.querySelector("#authIntro").textContent = registering
    ? "Preencha seus dados e aceite os termos para se cadastrar."
    : "Acesse sua conta para continuar sua compra.";

  document.querySelector("#authSubmit").innerHTML = registering
    ? "Criar minha conta <span>→</span>"
    : "Entrar na minha conta <span>→</span>";

  document.querySelector("#authMessage").textContent = "";

  document.querySelector("#authPassword").autocomplete = registering
    ? "new-password"
    : "current-password";
}

// Abre o formulário de autenticação.
function openAuth(mode = "login", pendingCheckout = false) {
  checkoutPending = pendingCheckout;

  setAuthMode(mode);
  openModal(authModal);

  setTimeout(() => {
    document.querySelector("#authEmail").focus();
  }, 50);
}

// Botões para escolher login ou cadastro.
document.querySelector("#accountOpen").addEventListener("click", () => {
  if (currentUser) {
    const leave = confirm(
      `Você está conectado como ${currentUser.name}. Deseja sair da conta?`
    );

    if (leave) {
      currentUser = null;
      saveStorage("iwnz_current_user", null);
      updateAuthUI();
      showToast("Você saiu da sua conta.");
    }
  } else {
    openAuth("login");
  }
});

document.querySelector("#loginTab").addEventListener("click", () => {
  setAuthMode("login");
});

document.querySelector("#registerTab").addEventListener("click", () => {
  setAuthMode("register");
});

// Link "Minha conta" do rodapé.
document.querySelector("[data-open-account]").addEventListener("click", event => {
  event.preventDefault();
  openAuth("login");
});

// Atualiza o texto da conta no cabeçalho.
function updateAuthUI() {
  const label = document.querySelector("#accountLabel");

  label.textContent = currentUser
    ? currentUser.name.split(" ")[0]
    : "Entrar";
}

/* 10. Processamento do formulário de autenticação. */

document.querySelector("#authForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.querySelector("#fullName").value.trim();
  const email = document.querySelector("#authEmail").value.trim().toLowerCase();
  const password = document.querySelector("#authPassword").value;
  const message = document.querySelector("#authMessage");

  message.textContent = "";

  // Verifica o aceite obrigatório antes de criar a conta.
  if (authMode === "register") {
    const acceptedTerms = document.querySelector("#termsConsent").checked;
    const acceptedPrivacy = document.querySelector("#privacyConsent").checked;

    if (!acceptedTerms || !acceptedPrivacy) {
      message.textContent =
        "Aceite os Termos de Uso e a Política de Privacidade para continuar.";
      return;
    }

    if (password.length < 6) {
      message.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      return;
    }

    // Lista local de usuários para simular um cadastro.
    const users = loadStorage("iwnz_users", []);

    // Não permite cadastrar o mesmo e-mail duas vezes.
    if (users.some(user => user.email === email)) {
      message.textContent = "Este e-mail já possui cadastro neste navegador.";
      return;
    }

    // Guarda os dados e os consentimentos do cadastro demonstrativo.
    users.push({
      name,
      email,
      password,
      acceptedTerms: true,
      acceptedPrivacy: true,
      registeredAt: new Date().toISOString()
    });

    saveStorage("iwnz_users", users);

    currentUser = { name, email };
    saveStorage("iwnz_current_user", currentUser);

    updateAuthUI();
    closeModal(authModal);

    showToast("Cadastro demonstrativo realizado com sucesso.");

    // Se o cliente veio do checkout, continua o fluxo da compra.
    if (checkoutPending) {
      checkoutPending = false;
      startCheckout();
    }

    return;
  }

  // Procura uma conta já cadastrada no navegador.
  const users = loadStorage("iwnz_users", []);

  const user = users.find(item =>
    item.email === email && item.password === password
  );

  if (!user) {
    message.textContent =
      "E-mail ou senha incorretos. Confira os dados ou crie uma conta.";
    return;
  }

  // Inicia a sessão demonstrativa.
  currentUser = {
    name: user.name,
    email: user.email
  };

  saveStorage("iwnz_current_user", currentUser);

  updateAuthUI();
  closeModal(authModal);

  showToast(`Bem-vindo(a), ${currentUser.name}!`);

  // Se o login foi pedido durante a compra, segue para a confirmação.
  if (checkoutPending) {
    checkoutPending = false;
    startCheckout();
  }
});

/* 11. Finalização demonstrativa da compra. */

// O botão do carrinho inicia o processo de checkout.
document.querySelector("#checkoutButton").addEventListener("click", () => {
  if (cart.length === 0) {
    showToast("Adicione um produto antes de finalizar.");
    return;
  }

  // Exige login antes de continuar.
  if (!currentUser) {
    closeModal(cartModal);
    openAuth("login", true);
    return;
  }

  startCheckout();
});

// Cria o resumo e redireciona para a página de confirmação.
function startCheckout() {
  if (!currentUser) {
    openAuth("login", true);
    return;
  }

  if (cart.length === 0) {
    showToast("Seu carrinho está vazio.");
    return;
  }

  // Gera um identificador simples para a demonstração.
  const orderNumber = `IWNZ-${Date.now().toString().slice(-7)}`;

  const subtotal = getCartTotal();

  // Envia um resumo para a página seguinte usando sessionStorage.
  sessionStorage.setItem("iwnz_last_order", JSON.stringify({
    orderNumber,
    name: currentUser.name,
    total: subtotal,
    items: getCartCount(),
    date: new Date().toLocaleString("pt-BR")
  }));

  // Esvazia o carrinho depois da confirmação demonstrativa.
  cart = [];
  saveStorage("iwnz_cart", cart);

  // Redireciona para a página de pedido confirmado.
  window.location.href = "pedido-confirmado.html";
}

/* 12. Acessibilidade.
   Cada botão ativa uma classe CSS no body. */

document.querySelector("#accessibilityOpen").addEventListener("click", () => {
  openModal(accessibilityModal);
});

// Ativa ou desativa uma opção de acessibilidade.
function setAccessibility(buttonSelector, className, storageKey) {
  const button = document.querySelector(buttonSelector);

  const enabled = !document.body.classList.contains(className);

  document.body.classList.toggle(className, enabled);

  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = enabled ? "Ativado" : "Desativado";

  saveStorage(storageKey, enabled);
}

document.querySelector("#contrastToggle").addEventListener("click", () => {
  setAccessibility(
    "#contrastToggle",
    "high-contrast",
    "iwnz_contrast"
  );
});

document.querySelector("#fontToggle").addEventListener("click", () => {
  setAccessibility(
    "#fontToggle",
    "large-text",
    "iwnz_large_text"
  );
});

document.querySelector("#motionToggle").addEventListener("click", () => {
  setAccessibility(
    "#motionToggle",
    "reduce-motion",
    "iwnz_reduce_motion"
  );
});

// Recupera as preferências de acessibilidade salvas anteriormente.
function restoreAccessibility() {
  const settings = [
    ["iwnz_contrast", "high-contrast", "#contrastToggle"],
    ["iwnz_large_text", "large-text", "#fontToggle"],
    ["iwnz_reduce_motion", "reduce-motion", "#motionToggle"]
  ];

  settings.forEach(([key, className, selector]) => {
    const enabled = loadStorage(key, false);

    document.body.classList.toggle(className, enabled);

    const button = document.querySelector(selector);

    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Ativado" : "Desativado";
  });
}

// Restaura o site ao padrão de acessibilidade.
document.querySelector("#resetAccessibility").addEventListener("click", () => {
  const settings = [
    ["high-contrast", "#contrastToggle", "iwnz_contrast"],
    ["large-text", "#fontToggle", "iwnz_large_text"],
    ["reduce-motion", "#motionToggle", "iwnz_reduce_motion"]
  ];

  settings.forEach(([className, selector, key]) => {
    document.body.classList.remove(className);

    const button = document.querySelector(selector);

    button.setAttribute("aria-pressed", "false");
    button.textContent = "Desativado";

    saveStorage(key, false);
  });

  showToast("Acessibilidade restaurada ao padrão.");
});

/* 13. Consentimento de cookies. */

// Exibe o banner se ainda não houver uma escolha salva.
function setupCookies() {
  const choice = loadStorage("iwnz_cookie_choice", null);

  document.querySelector("#cookieBanner").hidden = Boolean(choice);
}

// Guarda a opção escolhida pelo usuário.
function chooseCookies(choice) {
  saveStorage("iwnz_cookie_choice", {
    choice,
    date: new Date().toISOString()
  });

  document.querySelector("#cookieBanner").hidden = true;

  showToast(
    choice === "all"
      ? "Preferências: todos os cookies aceitos."
      : "Preferências: apenas cookies essenciais."
  );
}

// Botão de aceitar todos.
document.querySelector("#acceptCookies").addEventListener("click", () => {
  chooseCookies("all");
});

// Botão de aceitar somente os essenciais.
document.querySelector("#essentialCookies").addEventListener("click", () => {
  chooseCookies("essential");
});

// Permite reabrir o banner pelo rodapé.
document.querySelector("#footerCookies").addEventListener("click", event => {
  event.preventDefault();

  document.querySelector("#cookieBanner").hidden = false;

  document.querySelector("#cookieBanner").scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
});

/* 14. Informações sobre privacidade e termos. */

// Conteúdo explicativo do protótipo acadêmico.
const legalContent = `
  <p><b>Este site é um protótipo acadêmico.</b>
  Não processa pagamentos, não envia e-mails e não possui servidor
  de autenticação.</p>

  <h3>Dados e cadastro</h3>
  <p>O nome e o e-mail inseridos são usados para simular a experiência
  de login no navegador. Não utilize dados reais ou sensíveis.</p>

  <h3>Cookies e armazenamento local</h3>
  <p>O navegador guarda preferências, favoritos, carrinho e uma sessão
  demonstrativa. A escolha de cookies é ilustrativa e não instala
  ferramentas de rastreamento.</p>

  <h3>Termos de uso</h3>
  <ul>
    <li>Os produtos, preços, avaliações e ofertas são fictícios.</li>
    <li>O checkout gera uma confirmação local e não cria um pedido real.</li>
    <li>Uma loja real precisa de servidor seguro, proteção de dados
    e integração de pagamento confiável.</li>
  </ul>
`;

// Abre o modal com as informações legais.
function openLegalInfo() {
  document.querySelector("#infoTitle").textContent =
    "Privacidade, dados e termos";

  document.querySelector("#infoContent").innerHTML = legalContent;

  openModal(infoModal);
}

// Conecta os links de termos e privacidade ao modal.
document.querySelectorAll("[data-open-terms]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    openLegalInfo();
  });
});

// Contato demonstrativo.
document.querySelector("#footerContact").addEventListener("click", event => {
  event.preventDefault();

  showToast("Contato demonstrativo: adicione aqui seu canal oficial.");
});

/* 15. Newsletter demonstrativa. */

document.querySelector("#newsletterForm").addEventListener("submit", event => {
  event.preventDefault();

  showToast("Inscrição simulada! Nenhum e-mail foi enviado.");

  event.target.reset();
});

/* 16. Inicialização.
   Executa as funções necessárias quando o script é carregado. */

renderProducts();
renderCart();
updateAuthUI();
restoreAccessibility();
setupCookies();