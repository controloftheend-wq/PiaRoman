const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600';
const FREE_SHIPPING_MIN = 1500;
const SHIPPING_COST = 149;

const BASE_COUPONS = [
  { code: 'CYBER10', discountPct: 10, title: '10% DTO', desc: 'Válido en toda la tienda sin mínimo de compra.', won: false },
  { code: 'SETUP15', discountPct: 15, title: '15% DTO', desc: 'Ideal para armar o renovar tu setup completo.', won: false },
  { code: 'PRO20', discountPct: 20, title: '20% DTO', desc: 'Descuento especial en hardware y consolas.', won: false }
];

const WHEEL_PRIZES = [
  { label: '10% DTO', code: 'ROULETTE10', discountPct: 10, color: '#111111', text: '#ffffff' },
  { label: '25% DTO', code: 'ROULETTE25', discountPct: 25, color: '#ff3b1d', text: '#ffffff' },
  { label: '15% DTO', code: 'ROULETTE15', discountPct: 15, color: '#eaeae6', text: '#111111' },
  { label: '50% DTO', code: 'MEGA50', discountPct: 50, color: '#111111', text: '#ffffff' },
  { label: '30% DTO', code: 'ROULETTE30', discountPct: 30, color: '#ff3b1d', text: '#ffffff' },
  { label: '20% DTO', code: 'ROULETTE20', discountPct: 20, color: '#f3f3f1', text: '#111111' }
];

let productos = [];
let categoriaActual = 'Todas';
let precioActual = 'all';
let ordenActual = 'relevance';
let textoBusqueda = '';
let productoActual = null;
let disenoSeleccionado = null;
let cantidadDetalle = 1;
let isSpinning = false;
let currentRotation = 0;

let carrito = JSON.parse(localStorage.getItem('cyber_cart') || '[]');
let cuponesGanados = JSON.parse(localStorage.getItem('cyber_won_coupons') || '[]');
let cuponActivo = JSON.parse(localStorage.getItem('cyber_active_coupon') || 'null');

function formatMoney(num) {
  return Number(num || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getImagenProducto(producto, designIndex = 0) {
  if (Array.isArray(producto.disenos) && producto.disenos.length > 0) {
    return producto.disenos[designIndex]?.imagen || PLACEHOLDER_IMG;
  }
  return producto.imagen || PLACEHOLDER_IMG;
}

function mostrarToast(mensaje) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

/* ===== INICIALIZACIÓN ===== */
document.addEventListener('DOMContentLoaded', async () => {
  iniciarCarrusel();
  actualizarContadorCarrito();
  renderizarCarrito();
  actualizarContadorCupones();
  configurarBuscador();

  if (document.getElementById('products-container')) {
    await cargarProductos();
  }

  if (document.getElementById('coupons-container')) {
    renderizarCupones();
  }

  if (document.getElementById('temu-wheel-canvas')) {
    inicializarRuleta();
  }
});

function iniciarCarrusel() {
  const slides = document.querySelectorAll('.carousel-slide');
  if (slides.length < 2) return;
  let idx = 0;
  setInterval(() => {
    slides[idx].classList.remove('active');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
  }, 4800);
}

/* ===== CARGA DE PRODUCTOS ===== */
async function cargarProductos() {
  const grid = document.getElementById('products-container');
  try {
    const res = await fetch('productos.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    productos = data
      .filter(p => p && p.nombre && typeof p.precio === 'number')
      .map(p => ({
        ...p,
        categoria: p.categoria || 'Consolas',
        disenos: Array.isArray(p.disenos) ? p.disenos : []
      }));

    actualizarConteoCategorias();
    renderizarCatalogo();
  } catch (err) {
    console.error('Error cargando productos.json:', err);
    if (grid) {
      grid.innerHTML = `<div class="empty-state">No se pudo cargar <strong>productos.json</strong>. Abre el proyecto usando un servidor local (Live Server o <code>python3 -m http.server</code>).</div>`;
    }
  }
}

function actualizarConteoCategorias() {
  document.querySelectorAll('.cat-count').forEach(el => {
    const cat = el.dataset.cat;
    if (cat === 'Todas') {
      el.textContent = productos.length;
    } else {
      el.textContent = productos.filter(p => p.categoria === cat).length;
    }
  });
}

function getProductosFiltrados() {
  let lista = productos.filter(p => {
    const matchCat = categoriaActual === 'Todas' || p.categoria === categoriaActual;
    const matchText = !textoBusqueda ||
      p.nombre.toLowerCase().includes(textoBusqueda) ||
      (p.descripcion || '').toLowerCase().includes(textoBusqueda) ||
      p.categoria.toLowerCase().includes(textoBusqueda);

    let matchPrice = true;
    if (precioActual === 'under-1000') matchPrice = p.precio < 1000;
    else if (precioActual === '1000-5000') matchPrice = p.precio >= 1000 && p.precio <= 5000;
    else if (precioActual === 'over-5000') matchPrice = p.precio > 5000;

    return matchCat && matchText && matchPrice;
  });

  if (ordenActual === 'price-asc') {
    lista = [...lista].sort((a, b) => a.precio - b.precio);
  } else if (ordenActual === 'price-desc') {
    lista = [...lista].sort((a, b) => b.precio - a.precio);
  }
  return lista;
}

function renderizarCatalogo() {
  const container = document.getElementById('products-container');
  const counter = document.getElementById('results-counter');
  if (!container) return;

  const filtrados = getProductosFiltrados();
  if (counter) {
    counter.textContent = `Mostrando ${filtrados.length} de ${productos.length} productos`;
  }

  if (filtrados.length === 0) {
    container.innerHTML = `<div class="empty-state">No se encontraron productos con los filtros actuales.</div>`;
    return;
  }

  container.innerHTML = filtrados.map(p => {
    const img = getImagenProducto(p);
    const envioGratis = p.precio >= FREE_SHIPPING_MIN ? '<span class="free-shipping-tag">ENVÍO GRATIS</span>' : '';
    const variantes = p.disenos.length > 1 ? `<div class="product-variants">${p.disenos.length} ediciones disponibles</div>` : '';

    return `
      <article class="product-card">
        <div>
          <div class="product-img-wrap" onclick="verDetalle(${p.id})">
            <img class="product-img" src="${img}" alt="${p.nombre}" loading="lazy">
          </div>
          <div class="product-badges">
            <span class="product-cat-label">${p.categoria}</span>
            ${envioGratis}
          </div>
          <h3 class="product-title" onclick="verDetalle(${p.id})">${p.nombre}</h3>
        </div>
        <div>
          <div class="product-price">$${formatMoney(p.precio)}</div>
          ${variantes}
          <button class="btn-add" onclick="agregarRapido(${p.id})">Agregar al carrito</button>
        </div>
      </article>
    `;
  }).join('');
}

/* ===== FILTROS Y BUSCADOR ===== */
function filtrarCategoria(categoria, btn) {
  categoriaActual = categoria;
  document.querySelectorAll('#category-filters .cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarCatalogo();
}

function filtrarPrecio(rango, btn) {
  precioActual = rango;
  document.querySelectorAll('#price-filters .cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderizarCatalogo();
}

function cambiarOrden(orden) {
  ordenActual = orden;
  renderizarCatalogo();
}

function filtrarProductos() {
  const input = document.getElementById('search-input');
  textoBusqueda = (input?.value || '').trim().toLowerCase();
  renderizarCatalogo();
}

function configurarBuscador() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('search-autocomplete');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    textoBusqueda = val;
    if (clearBtn) clearBtn.hidden = !val;

    if (document.getElementById('home-view')?.classList.contains('active')) {
      renderizarCatalogo();
    }

    if (!dropdown) return;
    if (!val) {
      dropdown.hidden = true;
      return;
    }

    const matches = productos.filter(p => p.nombre.toLowerCase().includes(val)).slice(0, 5);
    if (matches.length === 0) {
      dropdown.hidden = true;
      return;
    }

    dropdown.innerHTML = matches.map(p => `
      <div class="autocomplete-item" onclick="seleccionarAutocompletado(${p.id})">
        <img src="${getImagenProducto(p)}" alt="${p.nombre}">
        <div class="autocomplete-item-info">
          <div class="autocomplete-item-title">${p.nombre}</div>
          <div class="autocomplete-item-meta">${p.categoria} · $${formatMoney(p.precio)}</div>
        </div>
      </div>
    `).join('');
    dropdown.hidden = false;
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    textoBusqueda = '';
    clearBtn.hidden = true;
    if (dropdown) dropdown.hidden = true;
    renderizarCatalogo();
  });

  document.addEventListener('click', (e) => {
    if (dropdown && !e.target.closest('.search-wrapper')) {
      dropdown.hidden = true;
    }
  });
}

function seleccionarAutocompletado(id) {
  const dropdown = document.getElementById('search-autocomplete');
  if (dropdown) dropdown.hidden = true;
  verDetalle(id);
}

/* ===== DETALLE BUY BOX ===== */
function verDetalle(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto) return;

  productoActual = producto;
  cantidadDetalle = 1;
  disenoSeleccionado = producto.disenos[0] || { nombre: 'Estándar', imagen: getImagenProducto(producto) };

  document.getElementById('home-view').classList.remove('active');
  document.getElementById('product-detail-view').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('detail-breadcrumbs').innerHTML = `
    <button onclick="mostrarPaginaInicio()">Catálogo</button> /
    <button onclick="irACategoria('${producto.categoria}')">${producto.categoria}</button> /
    <span>${producto.nombre}</span>
  `;

  document.getElementById('detail-category').textContent = producto.categoria;
  document.getElementById('detail-title').textContent = producto.nombre;
  document.getElementById('detail-desc').textContent = producto.descripcion || 'Producto original con garantía oficial.';
  document.getElementById('detail-img').src = disenoSeleccionado.imagen;
  document.getElementById('selected-design-name').textContent = disenoSeleccionado.nombre;
  document.getElementById('detail-qty').textContent = '1';

  const priceEl = document.getElementById('buy-box-price');
  priceEl.textContent = `$${formatMoney(producto.precio)}`;

  const discountEl = document.getElementById('buy-box-discount');
  if (cuponActivo) {
    const finalPrice = producto.precio * (1 - cuponActivo.discountPct / 100);
    discountEl.textContent = `Con cupón ${cuponActivo.code} (${cuponActivo.discountPct}% DTO): $${formatMoney(finalPrice)}`;
    discountEl.hidden = false;
  } else {
    discountEl.hidden = true;
  }

  const shippingEl = document.getElementById('buy-box-shipping');
  shippingEl.textContent = producto.precio >= FREE_SHIPPING_MIN
    ? '✓ Envío GRATIS a todo el país'
    : `Envío estándar $${formatMoney(SHIPPING_COST)} (Gratis desde $${formatMoney(FREE_SHIPPING_MIN)})`;

  const designsContainer = document.getElementById('detail-designs');
  if (producto.disenos.length > 0) {
    designsContainer.innerHTML = producto.disenos.map((d, idx) => `
      <img src="${d.imagen}" alt="${d.nombre}" class="design-thumb ${idx === 0 ? 'active' : ''}" onclick="seleccionarDiseno(${idx}, this)">
    `).join('');
  } else {
    designsContainer.innerHTML = `<span class="product-variants">Edición única estándar</span>`;
  }

  document.getElementById('detail-add-btn').onclick = () => {
    agregarAlCarrito(producto, disenoSeleccionado, cantidadDetalle);
  };

  renderizarRelacionados(producto);
}

function seleccionarDiseno(idx, thumb) {
  if (!productoActual || !productoActual.disenos[idx]) return;
  disenoSeleccionado = productoActual.disenos[idx];
  document.getElementById('detail-img').src = disenoSeleccionado.imagen;
  document.getElementById('selected-design-name').textContent = disenoSeleccionado.nombre;
  document.querySelectorAll('.design-thumb').forEach(el => el.classList.remove('active'));
  thumb.classList.add('active');
}

function cambiarCantidadDetalle(delta) {
  cantidadDetalle = Math.max(1, cantidadDetalle + delta);
  document.getElementById('detail-qty').textContent = cantidadDetalle;
}

function comprarAhoraDetalle() {
  if (!productoActual) return;
  agregarAlCarrito(productoActual, disenoSeleccionado, cantidadDetalle);
  toggleCarrito(true);
}

function renderizarRelacionados(producto) {
  const section = document.getElementById('related-section');
  const grid = document.getElementById('related-products-grid');
  if (!section || !grid) return;

  const relacionados = productos
    .filter(p => p.categoria === producto.categoria && p.id !== producto.id)
    .slice(0, 4);

  if (relacionados.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  grid.innerHTML = relacionados.map(p => `
    <article class="product-card">
      <div class="product-img-wrap" onclick="verDetalle(${p.id})">
        <img class="product-img" src="${getImagenProducto(p)}" alt="${p.nombre}">
      </div>
      <h3 class="product-title" onclick="verDetalle(${p.id})">${p.nombre}</h3>
      <div class="product-price">$${formatMoney(p.precio)}</div>
    </article>
  `).join('');
}

function mostrarPaginaInicio() {
  const home = document.getElementById('home-view');
  const detail = document.getElementById('product-detail-view');
  if (home && detail) {
    detail.classList.remove('active');
    home.classList.add('active');
  }
}

function irACategoria(cat) {
  mostrarPaginaInicio();
  const btn = [...document.querySelectorAll('#category-filters .cat-btn')].find(b => b.textContent.includes(cat));
  filtrarCategoria(cat, btn);
}

/* ===== CARRITO ===== */
function agregarRapido(id) {
  const p = productos.find(item => item.id === id);
  if (!p) return;
  const diseno = p.disenos[0] || { nombre: 'Estándar', imagen: getImagenProducto(p) };
  agregarAlCarrito(p, diseno, 1);
}

function agregarAlCarrito(producto, diseno, cantidad = 1) {
  const variant = diseno?.nombre || 'Estándar';
  const img = diseno?.imagen || getImagenProducto(producto);
  const existente = carrito.find(item => item.id === producto.id && item.variant === variant);

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      imagen: img,
      variant,
      cantidad
    });
  }

  guardarCarrito();
  mostrarToast(`✓ ${producto.nombre} agregado al carrito`);
}

function cambiarCantidadCarrito(idx, delta) {
  if (!carrito[idx]) return;
  carrito[idx].cantidad += delta;
  if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
  guardarCarrito();
}

function eliminarDelCarrito(idx) {
  carrito.splice(idx, 1);
  guardarCarrito();
}

function vaciarCarrito() {
  if (carrito.length === 0) {
    mostrarToast('Tu carrito está vacío');
    return;
  }
  carrito = [];
  guardarCarrito();
  toggleCarrito(false);
  mostrarToast('✓ Compra realizada con éxito');
}

function guardarCarrito() {
  localStorage.setItem('cyber_cart', JSON.stringify(carrito));
  actualizarContadorCarrito();
  renderizarCarrito();
}

function actualizarContadorCarrito() {
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  document.querySelectorAll('#cart-count').forEach(el => { el.textContent = totalItems; });
}

function renderizarCarrito() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (carrito.length === 0) {
    container.innerHTML = `<p style="font-family: var(--font-mono); font-size: 12px; color: var(--muted); padding: 24px 0;">Tu carrito está vacío.</p>`;
  } else {
    container.innerHTML = carrito.map((item, idx) => `
      <div class="cart-item">
        <img src="${item.imagen}" alt="${item.nombre}">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.nombre}</div>
          <div class="cart-item-variant">${item.variant} · $${formatMoney(item.precio)}</div>
          <div class="cart-item-controls">
            <button class="cart-qty-btn" onclick="cambiarCantidadCarrito(${idx}, -1)">−</button>
            <span>${item.cantidad}</span>
            <button class="cart-qty-btn" onclick="cambiarCantidadCarrito(${idx}, 1)">+</button>
            <button class="cart-remove-btn" onclick="eliminarDelCarrito(${idx})">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  const subtotal = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const discount = cuponActivo ? subtotal * (cuponActivo.discountPct / 100) : 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = subtotal === 0 || afterDiscount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;
  const total = afterDiscount + shipping;

  document.getElementById('cart-subtotal').textContent = `$${formatMoney(subtotal)}`;
  document.getElementById('cart-shipping').textContent = shipping === 0 ? 'GRATIS' : `$${formatMoney(shipping)}`;
  document.getElementById('cart-total').textContent = formatMoney(total);

  const discountRow = document.getElementById('cart-discount-row');
  const discountVal = document.getElementById('cart-discount');
  const couponStatus = document.getElementById('cart-coupon-status');

  if (cuponActivo) {
    discountRow.hidden = false;
    discountVal.textContent = `-$${formatMoney(discount)}`;
    couponStatus.innerHTML = `<span>Cupón activo: ${cuponActivo.code} (-${cuponActivo.discountPct}%)</span><button class="cart-remove-btn" onclick="quitarCupon()">Quitar</button>`;
  } else {
    discountRow.hidden = true;
    couponStatus.innerHTML = `<span>¿Tienes un cupón? <a href="promociones.html" style="color:inherit;">Ir a Promociones</a></span>`;
  }
}

function toggleCarrito(forceState) {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;
  if (typeof forceState === 'boolean') {
    drawer.classList.toggle('open', forceState);
  } else {
    drawer.classList.toggle('open');
  }
}

/* ===== CUPONES Y RULETA (PROMOCIONES.HTML) ===== */
function getTodosLosCupones() {
  const map = new Map();
  [...BASE_COUPONS, ...cuponesGanados].forEach(c => map.set(c.code, c));
  return [...map.values()];
}

function actualizarContadorCupones() {
  const count = getTodosLosCupones().length;
  document.querySelectorAll('#coupons-count').forEach(el => { el.textContent = count; });
}

function irACupones() {
  const sec = document.getElementById('coupons-section');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

function renderizarCupones() {
  const container = document.getElementById('coupons-container');
  if (!container) return;

  const lista = getTodosLosCupones();
  container.innerHTML = lista.map(c => {
    const isApplied = cuponActivo?.code === c.code;
    return `
      <article class="coupon-card ${c.won ? 'won-coupon' : ''}">
        <div>
          <span class="coupon-card-badge">${c.won ? 'Ganado en Ruleta' : 'Cupón Activo'}</span>
          <h3 class="coupon-card-title">${c.title}</h3>
          <p class="coupon-card-desc">${c.desc}</p>
        </div>
        <div class="coupon-card-footer">
          <span class="coupon-card-code">${c.code}</span>
          <div class="coupon-card-actions">
            <button class="coupon-btn-copy" onclick="copiarCodigo('${c.code}')">Copiar</button>
            <button class="coupon-btn-apply ${isApplied ? 'applied' : ''}" onclick="aplicarCupon('${c.code}')">
              ${isApplied ? 'Aplicado' : 'Aplicar'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function aplicarCupon(code) {
  const cupon = getTodosLosCupones().find(c => c.code === code);
  if (!cupon) return;
  cuponActivo = cupon;
  localStorage.setItem('cyber_active_coupon', JSON.stringify(cuponActivo));
  renderizarCupones();
  renderizarCarrito();
  mostrarToast(`✓ Cupón ${cupon.code} (${cupon.discountPct}% DTO) activado`);
}

function quitarCupon() {
  cuponActivo = null;
  localStorage.removeItem('cyber_active_coupon');
  renderizarCarrito();
}

function copiarCodigo(code) {
  navigator.clipboard?.writeText(code);
  mostrarToast(`Código ${code} copiado`);
}

function abrirRuleta() {
  const overlay = document.getElementById('temu-wheel-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function inicializarRuleta() {
  const overlay = document.getElementById('temu-wheel-overlay');
  const canvas = document.getElementById('temu-wheel-canvas');
  const closeBtn = document.getElementById('close-wheel-btn');
  const spinBtns = [document.getElementById('main-spin-btn'), document.getElementById('center-spin-btn')];
  const resultBox = document.getElementById('result-box');
  const prizeText = document.getElementById('result-prize-text');
  const codeText = document.getElementById('result-coupon-code');
  const copyBtn = document.getElementById('copy-coupon-btn');

  dibujarRuleta(canvas);

  closeBtn?.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  spinBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      if (isSpinning) return;
      isSpinning = true;
      const winIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
      const sliceDeg = 360 / WHEEL_PRIZES.length;
      const targetAngle = 360 * 5 + (270 - (winIndex * sliceDeg + sliceDeg / 2));
      currentRotation += targetAngle - (currentRotation % 360);
      canvas.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        isSpinning = false;
        const premio = WHEEL_PRIZES[winIndex];
        prizeText.textContent = premio.label;
        codeText.textContent = premio.code;
        resultBox.classList.add('active');

        const nuevoCupon = {
          code: premio.code,
          discountPct: premio.discountPct,
          title: premio.label,
          desc: 'Premio desbloqueado en la ruleta de promociones.',
          won: true
        };

        cuponesGanados = [...cuponesGanados.filter(c => c.code !== nuevoCupon.code), nuevoCupon];
        localStorage.setItem('cyber_won_coupons', JSON.stringify(cuponesGanados));
        aplicarCupon(nuevoCupon.code);
        actualizarContadorCupones();
        renderizarCupones();
      }, 4600);
    });
  });

  copyBtn?.addEventListener('click', () => copiarCodigo(codeText.textContent));
}

function dibujarRuleta(canvas) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 4;
  const slice = (2 * Math.PI) / WHEEL_PRIZES.length;

  WHEEL_PRIZES.forEach((p, i) => {
    const start = i * slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.fillStyle = p.text;
    ctx.font = 'bold 14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(p.label, radius - 18, 5);
    ctx.restore();
  });
}


/* cupones.js — Cupones de promoción de cyber.*/

const CLAVE_CUPON = 'cyber_cupon_activo';

// Lista de cupones disponibles. tipo: 'porcentaje' o 'monto' (pesos fijos)
const CUPONES = [
  { codigo: 'CYBER10',   titulo: 'Bienvenida cyber.',  tipo: 'porcentaje', valor: 10,  minimo: 0 },
  { codigo: 'AHORRA200', titulo: 'Ahorro directo',     tipo: 'monto',      valor: 200, minimo: 1500 },
  { codigo: 'PRO20',     titulo: 'Compra grande',      tipo: 'porcentaje', valor: 20,  minimo: 5000 },
  { codigo: 'MEGA500',   titulo: 'Mega descuento',     tipo: 'monto',      valor: 500, minimo: 8000 }
];

function formatoMXN(n) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- Cupón activo (se guarda en localStorage para que viaje entre páginas) ---
function obtenerCuponActivo() {
  try {
    const codigo = localStorage.getItem(CLAVE_CUPON);
    return CUPONES.find(c => c.codigo === codigo) || null;
  } catch (e) {
    return null;
  }
}

function activarCupon(codigo) {
  const cupon = CUPONES.find(c => c.codigo === codigo);
  if (!cupon) return null;
  try { localStorage.setItem(CLAVE_CUPON, cupon.codigo); } catch (e) { /* sin storage */ }
  return cupon;
}

function quitarCupon() {
  try { localStorage.removeItem(CLAVE_CUPON); } catch (e) { /* sin storage */ }
}

function calcularDescuento(cupon, subtotal) {
  if (!cupon || subtotal < cupon.minimo) return 0;
  const bruto = cupon.tipo === 'porcentaje' ? subtotal * cupon.valor / 100 : cupon.valor;
  return Math.min(Math.round(bruto * 100) / 100, subtotal);
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

/* restarPorPromo()
   Toma el subtotal del carrito, le resta el descuento del cupón activo
   y actualiza el resumen del carrito (subtotal, descuento, total).
   Devuelve { subtotal, descuento, total }. */
function restarPorPromo() {
  const cupon = obtenerCuponActivo();
  const items = (typeof carrito !== 'undefined' && Array.isArray(carrito)) ? carrito : [];
  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cant, 0);
  const descuento = calcularDescuento(cupon, subtotal);

  // El envío lo calcula el carrito; si no es un número (ej. "Gratis") cuenta como 0
  const envioEl = document.getElementById('cart-shipping');
  const envio = envioEl ? (parseFloat(envioEl.textContent.replace(/[^0-9.]/g, '')) || 0) : 0;
  const total = subtotal - descuento + envio;

  setTexto('cart-subtotal', formatoMXN(subtotal));
  setTexto('cart-discount', '-' + formatoMXN(descuento));
  setTexto('cart-total', total.toFixed(2));
  setTexto('coupons-count', cupon ? 1 : 0);

  const filaDescuento = document.getElementById('cart-discount-row');
  if (filaDescuento) filaDescuento.hidden = descuento <= 0;

  let mensaje = '';
  if (cupon && items.length > 0) {
    mensaje = descuento > 0
      ? `Cupón ${cupon.codigo} aplicado: ahorras ${formatoMXN(descuento)}`
      : `El cupón ${cupon.codigo} necesita una compra mínima de ${formatoMXN(cupon.minimo)}`;
  }
  setTexto('cart-coupon-status', mensaje);

  return { subtotal, descuento, total };
}

// Cada vez que el carrito se actualiza, se vuelve a restar la promo
if (typeof actualizarCarrito === 'function') {
  const actualizarCarritoOriginal = actualizarCarrito;
  window.actualizarCarrito = function () {
    actualizarCarritoOriginal.apply(this, arguments);
    restarPorPromo();
  };
}

document.addEventListener('DOMContentLoaded', restarPorPromo);