(() => {
  "use strict";

  const CONFIG = window.CATALOG_CONFIG || {};
  const STORAGE_KEY = "familia-fort-cart-v1";
  const state = {
    catalog: null,
    products: [],
    filtered: [],
    category: "Todos",
    query: "",
    sort: "featured",
    visible: Number(CONFIG.pageSize || 24),
    cart: loadCart(),
    modalProduct: null,
    toastTimer: null
  };

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    search: $("#searchInput"),
    categoryRow: $("#categoryRow"),
    sort: $("#sortSelect"),
    productGrid: $("#productGrid"),
    resultsText: $("#resultsText"),
    emptyState: $("#emptyState"),
    clearFilters: $("#clearFilters"),
    loadMore: $("#loadMore"),
    heroGrid: $("#heroGrid"),
    heroProductCount: $("#heroProductCount"),
    heroCategoryCount: $("#heroCategoryCount"),
    overlay: $("#overlay"),
    cartDrawer: $("#cartDrawer"),
    cartTrigger: $("#cartTrigger"),
    cartClose: $("#cartClose"),
    cartCount: $("#cartCount"),
    cartItems: $("#cartItems"),
    cartEmpty: $("#cartEmpty"),
    cartSummary: $("#cartSummary"),
    cartUnits: $("#cartUnits"),
    cartTotal: $("#cartTotal"),
    checkoutButton: $("#checkoutButton"),
    checkoutNote: $("#checkoutNote"),
    shippingProgress: $("#shippingProgress span"),
    productModal: $("#productModal"),
    modalClose: $("#modalClose"),
    modalImage: $("#modalImage"),
    thumbRow: $("#thumbRow"),
    modalCategory: $("#modalCategory"),
    modalTitle: $("#modalTitle"),
    modalSku: $("#modalSku"),
    modalPrice: $("#modalPrice"),
    modalTerms: $("#modalTerms"),
    modalDescription: $("#modalDescription"),
    modalQuantity: $("#modalQuantity"),
    modalMinus: $("#modalMinus"),
    modalPlus: $("#modalPlus"),
    modalAdd: $("#modalAdd"),
    orderModal: $("#orderModal"),
    orderClose: $("#orderClose"),
    orderForm: $("#orderForm"),
    orderShipping: $("#orderShipping"),
    heroHelp: $("#heroHelp"),
    footerHelp: $("#footerHelp"),
    toast: $("#toast")
  };

  function loadCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return cart && typeof cart === "object" ? cart : {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
  }

  function formatPrice(value) {
    return new Intl.NumberFormat(CONFIG.locale || "es-CO", {
      style: "currency",
      currency: CONFIG.currency || "COP",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function imageOrPlaceholder(product) {
    return product.images?.[0] ? resolveAsset(product.images[0]) : makePlaceholder(product.name);
  }

  function resolveAsset(source) {
    if (!source || /^(data:|https?:)/i.test(source)) return source;
    return new URL(String(source).replace(/^\/+/, ""), document.baseURI).href;
  }

  function makePlaceholder(name) {
    const initials = String(name || "FF").split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#e3f0f1"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#0b6471" font-family="Arial" font-size="110" font-weight="700">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function createButton(text, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
  }

  function renderHero() {
    elements.heroProductCount.textContent = String(state.catalog.meta.product_count);
    elements.heroCategoryCount.textContent = String(state.catalog.meta.category_count);
    const heroProducts = state.products.filter((item) => item.images?.length).slice(2, 5);
    elements.heroGrid.replaceChildren();
    heroProducts.forEach((product) => {
      const tile = document.createElement("div");
      tile.className = "hero-tile";
      const image = document.createElement("img");
      image.src = imageOrPlaceholder(product);
      image.alt = "";
      image.loading = "eager";
      tile.append(image);
      elements.heroGrid.append(tile);
    });
  }

  function renderCategories() {
    elements.categoryRow.replaceChildren();
    const categories = ["Todos", ...state.catalog.categories];
    categories.forEach((category) => {
      const button = createButton(category, `category-chip${state.category === category ? " active" : ""}`, () => {
        state.category = category;
        state.visible = Number(CONFIG.pageSize || 24);
        renderCategories();
        applyFilters();
      });
      button.setAttribute("aria-pressed", state.category === category ? "true" : "false");
      elements.categoryRow.append(button);
    });
  }

  function applyFilters() {
    const needle = normalize(state.query);
    let products = state.products.filter((product) => {
      const matchesCategory = state.category === "Todos" || product.category === state.category;
      const haystack = normalize(`${product.name} ${product.sku} ${product.category} ${product.description}`);
      return matchesCategory && (!needle || haystack.includes(needle));
    });

    products = [...products].sort((a, b) => {
      if (state.sort === "name-asc") return a.name.localeCompare(b.name, "es");
      if (state.sort === "price-asc") return a.price - b.price;
      if (state.sort === "price-desc") return b.price - a.price;
      return Number(b.featured) - Number(a.featured);
    });

    state.filtered = products;
    renderProducts();
  }

  function productCard(product) {
    const article = document.createElement("article");
    article.className = "product-card";
    article.dataset.productId = product.id;

    const imageButton = createButton("", "product-image-button", () => openProduct(product.id));
    imageButton.setAttribute("aria-label", `Ver ${product.name}`);
    const image = document.createElement("img");
    image.src = imageOrPlaceholder(product);
    image.alt = product.name;
    image.loading = "lazy";
    image.decoding = "async";
    imageButton.append(image);

    if (product.featured) {
      const badge = document.createElement("span");
      badge.className = "product-badge";
      badge.textContent = "Destacado";
      imageButton.append(badge);
    }

    const quickAdd = createButton("＋", "quick-add", (event) => {
      event.stopPropagation();
      addToCart(product.id, 1);
    });
    quickAdd.setAttribute("aria-label", `Agregar ${product.name} al carrito`);
    imageButton.append(quickAdd);

    const body = document.createElement("div");
    body.className = "product-body";
    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category;
    const title = createButton(product.name, "product-title-button", () => openProduct(product.id));
    const sku = document.createElement("p");
    sku.className = "product-sku";
    sku.textContent = `Ref. ${product.sku}`;
    const restriction = product.payment_terms ? document.createElement("p") : null;
    if (restriction) {
      restriction.className = "product-restriction";
      restriction.textContent = product.payment_terms;
    }
    const bottom = document.createElement("div");
    bottom.className = "product-bottom";
    const price = document.createElement("strong");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);
    const details = createButton("Ver detalles", "view-link", () => openProduct(product.id));
    bottom.append(price, details);
    body.append(category, title, sku);
    if (restriction) body.append(restriction);
    body.append(bottom);
    article.append(imageButton, body);
    return article;
  }

  function renderProducts() {
    const visibleProducts = state.filtered.slice(0, state.visible);
    elements.productGrid.replaceChildren(...visibleProducts.map(productCard));
    const total = state.filtered.length;
    elements.resultsText.textContent = `${total} producto${total === 1 ? "" : "s"}${state.category === "Todos" ? "" : ` en ${state.category}`}`;
    elements.emptyState.hidden = total !== 0;
    elements.productGrid.hidden = total === 0;
    elements.loadMore.hidden = state.visible >= total || total === 0;
    if (!elements.loadMore.hidden) {
      const remaining = total - state.visible;
      elements.loadMore.textContent = `Mostrar más (${remaining})`;
    }
  }

  function openProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    state.modalProduct = product;
    elements.modalCategory.textContent = product.category;
    elements.modalTitle.textContent = product.name;
    elements.modalSku.textContent = `Referencia: ${product.sku}`;
    elements.modalPrice.textContent = formatPrice(product.price);
    elements.modalTerms.textContent = product.payment_terms || "";
    elements.modalTerms.hidden = !product.payment_terms;
    elements.modalDescription.textContent = product.description || "Consulta disponibilidad y detalles con nuestro equipo.";
    elements.modalQuantity.value = "1";
    renderGallery(product);
    openLayer("modal");
    elements.modalClose.focus();
  }

  function renderGallery(product) {
    const images = product.images?.length ? product.images.map(resolveAsset) : [makePlaceholder(product.name)];
    elements.modalImage.src = images[0];
    elements.modalImage.alt = product.name;
    elements.thumbRow.replaceChildren();
    images.forEach((src, index) => {
      const button = createButton("", `thumb-button${index === 0 ? " active" : ""}`, () => {
        elements.modalImage.src = src;
        elements.thumbRow.querySelectorAll(".thumb-button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
      });
      const image = document.createElement("img");
      image.src = src;
      image.alt = `${product.name}, imagen ${index + 1}`;
      button.append(image);
      elements.thumbRow.append(button);
    });
  }

  function closeModal() {
    elements.productModal.hidden = true;
    state.modalProduct = null;
    closeOverlayIfIdle();
  }

  function openLayer(type) {
    clearTimeout(state.toastTimer);
    elements.toast.classList.remove("show");
    elements.overlay.hidden = false;
    document.body.classList.add("no-scroll");
    if (type === "cart") {
      elements.cartDrawer.classList.add("open");
      elements.cartDrawer.setAttribute("aria-hidden", "false");
    } else {
      elements.productModal.hidden = false;
    }
  }

  function closeCart() {
    elements.cartDrawer.classList.remove("open");
    elements.cartDrawer.setAttribute("aria-hidden", "true");
    closeOverlayIfIdle();
  }

  function closeOrder() {
    elements.orderModal.hidden = true;
    closeOverlayIfIdle();
  }

  function openOrderForm() {
    const entries = cartEntries();
    const total = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    const minimum = Number(CONFIG.minimumOrder || 0);
    const freeShipping = Number(CONFIG.freeShippingThreshold || 0);
    if (!entries.length || total < minimum) {
      showToast(`El pedido mínimo es ${formatPrice(minimum)}`);
      return;
    }
    elements.cartDrawer.classList.remove("open");
    elements.cartDrawer.setAttribute("aria-hidden", "true");
    elements.orderShipping.textContent = total >= freeShipping
      ? `Tu pedido tiene envío gratis · Total ${formatPrice(total)}`
      : `Total ${formatPrice(total)} · El valor del envío se cotiza aparte`;
    elements.overlay.hidden = false;
    document.body.classList.add("no-scroll");
    elements.orderModal.hidden = false;
    $("#customerName").focus();
  }

  function closeOverlayIfIdle() {
    const cartOpen = elements.cartDrawer.classList.contains("open");
    const modalOpen = !elements.productModal.hidden;
    const orderOpen = !elements.orderModal.hidden;
    if (!cartOpen && !modalOpen && !orderOpen) {
      elements.overlay.hidden = true;
      document.body.classList.remove("no-scroll");
    }
  }

  function addToCart(productId, quantity) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const current = Number(state.cart[productId] || 0);
    state.cart[productId] = Math.min(99, current + Math.max(1, Number(quantity || 1)));
    saveCart();
    renderCart();
    showToast(`${product.name} agregado al carrito`);
  }

  function setQuantity(productId, quantity) {
    const next = Math.max(0, Math.min(99, Number(quantity || 0)));
    if (next === 0) delete state.cart[productId];
    else state.cart[productId] = next;
    saveCart();
    renderCart();
  }

  function cartEntries() {
    return Object.entries(state.cart)
      .map(([id, quantity]) => ({ product: state.products.find((item) => item.id === id), quantity: Number(quantity) }))
      .filter((entry) => entry.product && entry.quantity > 0);
  }

  function renderCart() {
    const entries = cartEntries();
    const units = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    elements.cartCount.textContent = String(units);
    elements.cartItems.replaceChildren();

    entries.forEach(({ product, quantity }) => {
      const item = document.createElement("article");
      item.className = "cart-item";
      const image = document.createElement("img");
      image.src = imageOrPlaceholder(product);
      image.alt = "";
      const info = document.createElement("div");
      const name = document.createElement("p");
      name.className = "cart-item-name";
      name.textContent = product.name;
      const price = document.createElement("p");
      price.className = "cart-item-price";
      price.textContent = formatPrice(product.price * quantity);
      const controls = document.createElement("div");
      controls.className = "item-quantity";
      const minus = createButton("−", "", () => setQuantity(product.id, quantity - 1));
      const value = document.createElement("span");
      value.textContent = String(quantity);
      const plus = createButton("＋", "", () => setQuantity(product.id, quantity + 1));
      controls.append(minus, value, plus);
      info.append(name, price);
      if (product.payment_terms) {
        const terms = document.createElement("p");
        terms.className = "product-restriction";
        terms.textContent = product.payment_terms;
        info.append(terms);
      }
      info.append(controls);
      const remove = createButton("×", "remove-item", () => setQuantity(product.id, 0));
      remove.setAttribute("aria-label", `Eliminar ${product.name}`);
      item.append(image, info, remove);
      elements.cartItems.append(item);
    });

    elements.cartEmpty.hidden = entries.length > 0;
    elements.cartSummary.hidden = entries.length === 0;
    elements.cartUnits.textContent = `${units} unidad${units === 1 ? "" : "es"}`;
    elements.cartTotal.textContent = formatPrice(total);
    const configured = Boolean(String(CONFIG.whatsapp || "").replace(/\D/g, ""));
    const minimum = Number(CONFIG.minimumOrder || 0);
    const freeShipping = Number(CONFIG.freeShippingThreshold || 0);
    elements.checkoutButton.disabled = !configured || total < minimum;
    elements.shippingProgress.style.width = `${Math.min(100, freeShipping ? (total / freeShipping) * 100 : 100)}%`;
    if (!configured) {
      elements.checkoutNote.textContent = "Falta configurar el número oficial de WhatsApp de Familia Fort.";
    } else if (total < minimum) {
      elements.checkoutNote.textContent = `Pedido mínimo ${formatPrice(minimum)} · Agrega ${formatPrice(minimum - total)} para continuar.`;
    } else if (total < freeShipping) {
      elements.checkoutNote.textContent = `Pedido habilitado · El envío se cotiza aparte. Agrega ${formatPrice(freeShipping - total)} para envío gratis.`;
    } else {
      elements.checkoutNote.textContent = `¡Envío gratis! Superaste ${formatPrice(freeShipping)}.`;
    }
  }

  function checkoutWhatsApp(event) {
    event?.preventDefault();
    const phone = String(CONFIG.whatsapp || "").replace(/\D/g, "");
    if (!phone) {
      showToast("Falta configurar el WhatsApp de Familia Fort");
      return;
    }
    if (!elements.orderForm.reportValidity()) return;
    const entries = cartEntries();
    if (!entries.length) return;
    const total = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    const minimum = Number(CONFIG.minimumOrder || 0);
    const freeShipping = Number(CONFIG.freeShippingThreshold || 0);
    if (total < minimum) {
      showToast(`El pedido mínimo es ${formatPrice(minimum)}`);
      return;
    }
    const data = new FormData(elements.orderForm);
    const value = (key) => String(data.get(key) || "").trim();
    const lines = [
      CONFIG.whatsappMessage || "Hola, quiero realizar este pedido:",
      "",
      "DATOS DEL CLIENTE",
      `Nombre: ${value("customerName")}`,
      `Celular: ${value("customerPhone")}`,
      `Ciudad: ${value("customerCity")}`,
      `Dirección: ${value("customerAddress")}`,
    ];
    if (value("customerNeighborhood")) lines.push(`Barrio: ${value("customerNeighborhood")}`);
    if (value("customerNotes")) lines.push(`Indicaciones: ${value("customerNotes")}`);
    lines.push("", "PRODUCTOS");
    entries.forEach(({ product, quantity }, index) => {
      lines.push(`${index + 1}. ${product.name}`);
      lines.push(`   Ref: ${product.sku} · Cantidad: ${quantity} · Unitario: ${formatPrice(product.price)} · Subtotal: ${formatPrice(product.price * quantity)}`);
      if (product.payment_terms) lines.push(`   Condición: ${product.payment_terms}`);
    });
    lines.push("", `TOTAL PRODUCTOS: ${formatPrice(total)}`);
    lines.push(total >= freeShipping ? "ENVÍO GRATIS" : "ENVÍO: Se cotiza aparte");
    lines.push("", "¿Me confirman disponibilidad y entrega?");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  function openHelp() {
    const phone = String(CONFIG.whatsapp || "").replace(/\D/g, "");
    if (!phone) {
      showToast("Falta configurar el WhatsApp oficial de Familia Fort");
      return;
    }
    const message = encodeURIComponent("Hola Familia Fort, necesito ayuda con el catálogo.");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function bindEvents() {
    let searchTimer;
    elements.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = elements.search.value.trim();
        state.visible = Number(CONFIG.pageSize || 24);
        applyFilters();
      }, 180);
    });
    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      applyFilters();
    });
    elements.loadMore.addEventListener("click", () => {
      state.visible += Number(CONFIG.pageSize || 24);
      renderProducts();
    });
    elements.clearFilters.addEventListener("click", () => {
      state.query = "";
      state.category = "Todos";
      elements.search.value = "";
      renderCategories();
      applyFilters();
    });
    elements.cartTrigger.addEventListener("click", () => openLayer("cart"));
    elements.cartClose.addEventListener("click", closeCart);
    elements.modalClose.addEventListener("click", closeModal);
    elements.orderClose.addEventListener("click", closeOrder);
    elements.overlay.addEventListener("click", () => {
      closeCart();
      closeModal();
      closeOrder();
    });
    elements.modalMinus.addEventListener("click", () => {
      elements.modalQuantity.value = String(Math.max(1, Number(elements.modalQuantity.value || 1) - 1));
    });
    elements.modalPlus.addEventListener("click", () => {
      elements.modalQuantity.value = String(Math.min(99, Number(elements.modalQuantity.value || 1) + 1));
    });
    elements.modalQuantity.addEventListener("change", () => {
      elements.modalQuantity.value = String(Math.max(1, Math.min(99, Number(elements.modalQuantity.value || 1))));
    });
    elements.modalAdd.addEventListener("click", () => {
      if (!state.modalProduct) return;
      addToCart(state.modalProduct.id, Number(elements.modalQuantity.value || 1));
      closeModal();
      openLayer("cart");
    });
    elements.checkoutButton.addEventListener("click", openOrderForm);
    elements.orderForm.addEventListener("submit", checkoutWhatsApp);
    elements.heroHelp.addEventListener("click", openHelp);
    elements.footerHelp.addEventListener("click", openHelp);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeCart();
      closeModal();
      closeOrder();
    });
  }

  async function init() {
    bindEvents();
    try {
      const response = await fetch("data/catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      state.products = state.catalog.products.filter((product) => product.available && product.price >= 0);
      renderHero();
      renderCategories();
      applyFilters();
      renderCart();
    } catch (error) {
      console.error("No se pudo cargar el catálogo", error);
      elements.resultsText.textContent = "No se pudo cargar el catálogo";
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector("strong").textContent = "El catálogo no está disponible";
      elements.emptyState.querySelector("p").textContent = "Recarga la página para intentarlo de nuevo.";
    }
  }

  init();
})();
