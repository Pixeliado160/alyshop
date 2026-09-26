/* ALYSHOP — lógica de inventario. Todo local (localStorage). */
(() => {
  "use strict";

  const KEY_DATA = "alyshop:v1";
  const KEY_THEME = "alyshop:theme";
  const money = (n) => "Q " + (Number(n) || 0).toFixed(2);
  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let products = [];
  let cart = [];        // { id, qty }
  let editingId = null;
  let pendingPhoto = null; // dataURL en el formulario

  /* ---------- persistencia ---------- */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_DATA) || "{}");
      products = Array.isArray(raw.products) ? raw.products : [];
      cart = Array.isArray(raw.cart) ? raw.cart : [];
    } catch { products = []; cart = []; }
  }
  function save() {
    try {
      localStorage.setItem(KEY_DATA, JSON.stringify({ products, cart }));
    } catch (e) {
      toast("No se pudo guardar: espacio lleno. Usa fotos más pequeñas.");
    }
  }

  /* ---------- tema ---------- */
  function initTheme() {
    const saved = localStorage.getItem(KEY_THEME);
    const dark = saved ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  $("#btn-theme").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEY_THEME, next);
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => { t.hidden = true; }, 320);
    }, 2400);
  }

  /* ---------- render de productos ---------- */
  const grid = $("#grid");
  const emptyEl = $("#empty");

  function render() {
    const q = $("#search").value.trim().toLowerCase();
    const list = products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q)
    );

    if (products.length === 0) {
      grid.innerHTML = ""; emptyEl.hidden = false; return;
    }
    emptyEl.hidden = true;

    if (list.length === 0) {
      grid.innerHTML = `<p style="color:var(--ink-3);grid-column:1/-1;padding:24px 4px">Sin resultados para “${escapeHtml(q)}”.</p>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      const out = Number(p.stock) <= 0;
      const photo = p.photo
        ? `<img src="${p.photo}" alt="${escapeHtml(p.name)}" loading="lazy">`
        : `<span class="noimg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1-1.6A1.5 1.5 0 0 1 9 4.7h6a1.5 1.5 0 0 1 1.3.7l1 1.6h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="12.5" r="3.2"/></svg></span>`;
      return `<article class="card" data-edit="${p.id}">
        <div class="card-photo">
          ${photo}
          <span class="card-stock ${out ? "out" : ""}">${out ? "Agotado" : p.stock + " en stock"}</span>
        </div>
        <div class="card-body">
          <h3 class="card-name">${escapeHtml(p.name)}</h3>
          <p class="card-note">${escapeHtml(p.note || "")}</p>
          <div class="card-foot">
            <span class="card-price">${money(p.price)}</span>
            <button class="card-add" data-add="${p.id}" ${out ? "disabled" : ""} type="button" aria-label="Agregar ${escapeHtml(p.name)} al carrito">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Agregar
            </button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* clicks en el grid (delegación) */
  grid.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); addToCart(add.dataset.add); return; }
    const card = e.target.closest("[data-edit]");
    if (card) openProduct(card.dataset.edit);
  });

  $("#search").addEventListener("input", render);

  /* ---------- formulario de producto ---------- */
  const sheetProduct = $("#sheet-product");
  const form = $("#form-product");

  function openProduct(id) {
    editingId = id || null;
    pendingPhoto = null;
    const p = id ? products.find(x => x.id === id) : null;
    $("#product-title").textContent = p ? "Editar producto" : "Nuevo producto";
    $("#p-name").value = p ? p.name : "";
    $("#p-price").value = p ? p.price : "";
    $("#p-stock").value = p ? p.stock : 1;
    $("#p-note").value = p ? (p.note || "") : "";
    setPhotoPreview(p ? p.photo : null);
    $("#btn-delete").hidden = !p;
    openSheet(sheetProduct);
    setTimeout(() => $("#p-name").focus(), 60);
  }

  function setPhotoPreview(dataURL) {
    const box = $("#photo-preview");
    const clear = $("#photo-clear");
    if (dataURL) {
      box.innerHTML = `<img src="${dataURL}" alt="Vista previa">`;
      clear.hidden = false;
    } else {
      box.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1-1.6A1.5 1.5 0 0 1 9 4.7h6a1.5 1.5 0 0 1 1.3.7l1 1.6h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="12.5" r="3.2"/></svg><span>Tomar o subir foto</span>`;
      clear.hidden = true;
    }
  }

  $("#photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPhoto = await resizeImage(file, 900, 0.72);
      setPhotoPreview(pendingPhoto);
    } catch { toast("No se pudo procesar la imagen."); }
    e.target.value = "";
  });

  $("#photo-clear").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    pendingPhoto = null; setPhotoPreview(null);
    if (editingId) { const p = products.find(x => x.id === editingId); if (p) p._clearPhoto = true; }
  });

  // Redimensiona a un lado máx. para no reventar localStorage
  function resizeImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => { img.src = reader.result; };
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maxSide) { h = h * maxSide / w; w = maxSide; }
        else if (h > maxSide) { w = w * maxSide / h; h = maxSide; }
        const c = document.createElement("canvas");
        c.width = Math.round(w); c.height = Math.round(h);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#p-name").value.trim();
    const price = parseFloat($("#p-price").value);
    const stock = parseInt($("#p-stock").value, 10);
    if (!name) return;

    if (editingId) {
      const p = products.find(x => x.id === editingId);
      p.name = name; p.price = price; p.stock = stock; p.note = $("#p-note").value.trim();
      if (pendingPhoto) p.photo = pendingPhoto;
      else if (p._clearPhoto) { p.photo = null; delete p._clearPhoto; }
      toast("Producto actualizado.");
    } else {
      products.unshift({ id: uid(), name, price, stock, note: $("#p-note").value.trim(), photo: pendingPhoto });
      toast("Producto creado.");
    }
    save(); render(); closeSheets();
  });

  $("#btn-delete").addEventListener("click", () => {
    if (!editingId) return;
    products = products.filter(x => x.id !== editingId);
    cart = cart.filter(c => c.id !== editingId);
    save(); render(); refreshCart(); closeSheets();
    toast("Producto eliminado.");
  });

  /* ---------- carrito ---------- */
  function addToCart(id) {
    const p = products.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    const line = cart.find(c => c.id === id);
    if (line) { if (line.qty < p.stock) line.qty++; else { toast("No hay más existencias."); return; } }
    else cart.push({ id, qty: 1 });
    save(); refreshCart(); bumpCount();
    toast(`${p.name} agregado.`);
  }

  function cartDetailed() {
    return cart.map(c => {
      const p = products.find(x => x.id === c.id);
      return p ? { ...p, qty: c.qty, sub: p.price * c.qty } : null;
    }).filter(Boolean);
  }

  function cartTotal() { return cartDetailed().reduce((s, l) => s + l.sub, 0); }

  function refreshCart() {
    const detailed = cartDetailed();
    const count = detailed.reduce((s, l) => s + l.qty, 0);
    $("#cart-count").textContent = count;
    $("#cart-total").textContent = money(cartTotal());

    const listEl = $("#cart-list");
    const emptyC = $("#cart-empty");
    if (detailed.length === 0) {
      listEl.innerHTML = ""; emptyC.style.display = "grid";
      $("#btn-receipt").disabled = true; $("#btn-clear-cart").disabled = true;
      return;
    }
    emptyC.style.display = "none";
    $("#btn-receipt").disabled = false; $("#btn-clear-cart").disabled = false;

    listEl.innerHTML = detailed.map(l => `
      <div class="cart-item">
        <div class="cart-thumb">${l.photo ? `<img src="${l.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>`}</div>
        <div class="cart-info">
          <p class="n">${escapeHtml(l.name)}</p>
          <p class="p">${money(l.price)} · ${money(l.sub)}</p>
        </div>
        <div class="qty">
          <button type="button" data-dec="${l.id}" aria-label="Menos">−</button>
          <span>${l.qty}</span>
          <button type="button" data-inc="${l.id}" aria-label="Más">+</button>
        </div>
      </div>`).join("");
  }

  $("#cart-list").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (inc) { addToCart(inc.dataset.inc); }
    if (dec) {
      const line = cart.find(c => c.id === dec.dataset.dec);
      if (line) { line.qty--; if (line.qty <= 0) cart = cart.filter(c => c !== line); save(); refreshCart(); }
    }
  });

  $("#btn-clear-cart").addEventListener("click", () => {
    if (cart.length === 0) return;
    cart = []; save(); refreshCart(); toast("Carrito vaciado.");
  });

  function bumpCount() {
    const el = $("#cart-count");
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }

  /* ---------- recibo ---------- */
  $("#btn-receipt").addEventListener("click", () => {
    const detailed = cartDetailed();
    if (detailed.length === 0) return;
    const now = new Date();
    const folio = "AS-" + now.getTime().toString().slice(-6);
    const fecha = now.toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });
    const hora = now.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });

    $("#receipt-body").innerHTML = `
      <div class="receipt-brand">
        <div class="w">ALYSHOP</div>
        <div class="m">Comprobante de venta</div>
      </div>
      <div class="receipt-meta">
        <span>Folio ${folio}</span>
        <span>${fecha} · ${hora}</span>
      </div>
      <div class="receipt-lines">
        ${detailed.map(l => `
          <div class="receipt-line">
            <span class="ln">${escapeHtml(l.name)}<br><span class="lq">${l.qty} × ${money(l.price)}</span></span>
            <span class="lp">${money(l.sub)}</span>
          </div>`).join("")}
      </div>
      <div class="receipt-total"><span>Total</span><strong>${money(cartTotal())}</strong></div>
      <p class="receipt-thanks">Gracias por su compra</p>`;
    openSheet($("#sheet-receipt"));
  });

  $("#btn-print").addEventListener("click", () => window.print());

  /* ---------- sheets: abrir/cerrar ---------- */
  function openSheet(el) { el.hidden = false; document.body.style.overflow = "hidden"; }
  function closeSheets() {
    document.querySelectorAll(".sheet").forEach(s => s.hidden = true);
    document.body.style.overflow = "";
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheets(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheets(); });

  $("#btn-add").addEventListener("click", () => openProduct(null));
  $("#btn-add-empty").addEventListener("click", () => openProduct(null));
  $("#btn-cart").addEventListener("click", () => { refreshCart(); openSheet($("#sheet-cart")); });

  /* ---------- init ---------- */
  initTheme();
  load();
  render();
  refreshCart();
})();
