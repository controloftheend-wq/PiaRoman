const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600';
const FREE_SHIPPING_MIN = 1500;
const SHIPPING_COST = 149;

const BASE_COUPONS = [
  {
    code: 'CYBER15',
    type: 'percent',
    discountPct: 15,
    badge: 'Descuento %',
    title: '15% DTO en Tienda',
    desc: 'Ahorra 15% en cualquier celular o producto sin mínimo de compra.',
    won: false
  },
  {
    code: 'ENVIOFREE',
    type: 'shipping',
    freeShipping: true,
    badge: 'Envío',
    title: 'Envío Gratis',
    desc: 'Elimina el costo de envío ($149 MXN) en pedidos menores a $1,500.',
    won: false
  },
  {
    code: 'BONO500',
    type: 'fixed',
    discountAmount: 500,
    minPurchase: 2500,
    badge: 'Bono MXN',
    title: '-$500 MXN Directos',
    desc: 'Descuento fijo de $500 MXN en compras desde $2,500 MXN.',
    won: false
  }
];

const WHEEL_PRIZES = [
  { label: '10% DTO', code: 'RULETA10', type: 'percent', discountPct: 10, desc: '10% de descuento desbloqueado en la ruleta.', color: '#1c1e21', text: '#ffffff' },
  { label: '25% DTO', code: 'RULETA25', type: 'percent', discountPct: 25, desc: '25% de descuento especial ganado en la ruleta.', color: '#2563eb', text: '#ffffff' },
  { label: '-$300 MXN', code: 'PREMIO300', type: 'fixed', discountAmount: 300, minPurchase: 1500, desc: '$300 MXN de descuento en compras desde $1,500.', color: '#eef0f4', text: '#1c1e21' },
  { label: '50% DTO', code: 'MEGA50', type: 'percent', discountPct: 50, desc: '¡Premio mayor! 50% de descuento en tu compra.', color: '#1c1e21', text: '#ffffff' },
  { label: 'ENVÍO VIP', code: 'ENVIOVIP', type: 'shipping', freeShipping: true, desc: 'Envío gratis VIP sin mínimo de compra.', color: '#2563eb', text: '#ffffff' },
  { label: '20% DTO', code: 'RULETA20', type: 'percent', discountPct: 20, desc: '20% de descuento desbloqueado en la ruleta.', color: '#eef0f4', text: '#1c1e21' }
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

/* ===== ANIMACIÓN DE TARJETAS AL HACER SCROLL ===== */
document.documentElement.classList.add('js-anim');

const observadorTarjetas = new IntersectionObserver((entradas) => {
  let n = 0;
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      entrada.target.style.setProperty('--i', n++);
      entrada.target.classList.add('is-visible');
      observadorTarjetas.unobserve(entrada.target);
    }
  });
}, { rootMargin: '0px 0px -8% 0px' });

function observarCatalogo(container) {
  if (!container) return;
  container.querySelectorAll('.product-card').forEach((card) => {
    observadorTarjetas.observe(card);
  });
}

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

  const productsContainer = document.getElementById('products-container');
  if (productsContainer) {
    new MutationObserver(() => observarCatalogo(productsContainer))
      .observe(productsContainer, { childList: true });
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
        categoria: p.categoria || 'Celulares',
        disenos: Array.isArray(p.disenos) ? p.disenos : []
      }));

    actualizarConteoCategorias();
    renderizarCatalogo();
  } catch (err) {
    console.error('Error cargando productos.json:', err);
    if (grid) {
      grid.innerHTML = `<div class="empty-state">No se pudo cargar <strong>productos.json</strong>. Abre el proyecto usando Live Server o <code>python3 -m http.server</code>.</div>`;
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
        <div class="product-card-inner">
          <div class="product-card-front">
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
              <button type="button" class="btn-add" onclick="agregarRapido(${p.id})">Agregar al carrito</button>
            </div>
          </div>
          <div class="product-card-back" aria-hidden="true"></div>
        </div>
      </article>
    `;
  }).join('');

  observarCatalogo(container);
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
    <button type="button" onclick="mostrarPaginaInicio()">Catálogo</button> /
    <button type="button" onclick="irACategoria('${producto.categoria}')">${producto.categoria}</button> /
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
    const beneficio = calcularBeneficioCupon(producto.precio, cuponActivo);
    const finalPrice = Math.max(0, producto.precio - beneficio.discount);
    discountEl.textContent = beneficio.discount > 0
      ? `Con cupón ${cuponActivo.code} (${beneficio.etiqueta}): $${formatMoney(finalPrice)}`
      : `Cupón activo ${cuponActivo.code}: ${beneficio.etiqueta}`;
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
    <article class="product-card is-visible">
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

/* ===== CARRITO Y CUPONES ===== */
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

function calcularBeneficioCupon(subtotal, cupon) {
  if (!cupon || subtotal <= 0) {
    return { discount: 0, freeShipping: false, etiqueta: '' };
  }
  if (cupon.type === 'shipping' || cupon.freeShipping) {
    return { discount: 0, freeShipping: true, etiqueta: 'Envío Gratis' };
  }
  if (cupon.type === 'fixed' && cupon.discountAmount) {
    const min = cupon.minPurchase || 0;
    if (subtotal < min) {
      return { discount: 0, freeShipping: false, etiqueta: `Mínimo $${formatMoney(min)}` };
    }
    const desc = Math.min(subtotal, cupon.discountAmount);
    return { discount: desc, freeShipping: false, etiqueta: `-$${formatMoney(desc)}` };
  }
  const pct = cupon.discountPct || 0;
  return {
    discount: subtotal * (pct / 100),
    freeShipping: false,
    etiqueta: `-${pct}%`
  };
}

function renderizarCarrito() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (carrito.length === 0) {
    container.innerHTML = `<p style="font-size: 0.9rem; color: var(--muted); padding: 24px 0;">Tu carrito está vacío.</p>`;
  } else {
    container.innerHTML = carrito.map((item, idx) => `
      <div class="cart-item">
        <img src="${item.imagen}" alt="${item.nombre}">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.nombre}</div>
          <div class="cart-item-variant">${item.variant} · $${formatMoney(item.precio)}</div>
          <div class="cart-item-controls">
            <button type="button" class="cart-qty-btn" onclick="cambiarCantidadCarrito(${idx}, -1)">−</button>
            <span>${item.cantidad}</span>
            <button type="button" class="cart-qty-btn" onclick="cambiarCantidadCarrito(${idx}, 1)">+</button>
            <button type="button" class="cart-remove-btn" onclick="eliminarDelCarrito(${idx})">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  const subtotal = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const beneficio = calcularBeneficioCupon(subtotal, cuponActivo);
  const afterDiscount = Math.max(0, subtotal - beneficio.discount);
  const shipping = (subtotal === 0 || afterDiscount >= FREE_SHIPPING_MIN || beneficio.freeShipping) ? 0 : SHIPPING_COST;
  const total = afterDiscount + shipping;

  document.getElementById('cart-subtotal').textContent = `$${formatMoney(subtotal)}`;
  document.getElementById('cart-shipping').textContent = shipping === 0 ? 'GRATIS' : `$${formatMoney(shipping)}`;
  document.getElementById('cart-total').textContent = formatMoney(total);

  const discountRow = document.getElementById('cart-discount-row');
  const discountVal = document.getElementById('cart-discount');
  const couponStatus = document.getElementById('cart-coupon-status');

  if (cuponActivo) {
    if (beneficio.discount > 0) {
      discountRow.hidden = false;
      discountVal.textContent = `-$${formatMoney(beneficio.discount)}`;
    } else {
      discountRow.hidden = true;
    }
    couponStatus.innerHTML = `<span>Cupón activo: ${cuponActivo.code} (${beneficio.etiqueta})</span><button type="button" class="cart-remove-btn" onclick="quitarCupon()">Quitar</button>`;
  } else {
    discountRow.hidden = true;
    couponStatus.innerHTML = `<span>¿Tienes un cupón? <a href="promociones.html" style="color:inherit;">Actívalo aquí</a></span>`;
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
    const etiquetaBadge = c.won ? 'Ganado en Ruleta' : (c.badge || 'Cupón Activo');
    return `
      <article class="coupon-card ${c.won ? 'won-coupon' : ''}">
        <div>
          <span class="coupon-card-badge">${etiquetaBadge}</span>
          <h3 class="coupon-card-title">${c.title}</h3>
          <p class="coupon-card-desc">${c.desc}</p>
        </div>
        <div class="coupon-card-footer">
          <span class="coupon-card-code">${c.code}</span>
          <div class="coupon-card-actions">
            <button type="button" class="coupon-btn-copy" onclick="copiarCodigo('${c.code}')">Copiar</button>
            <button type="button" class="coupon-btn-apply ${isApplied ? 'applied' : ''}" onclick="aplicarCupon('${c.code}')">
              ${isApplied ? 'Activado ✓' : 'Activar'}
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
  mostrarToast(`✓ Cupón ${cupon.code} (${cupon.title}) activado`);
}

function quitarCupon() {
  cuponActivo = null;
  localStorage.removeItem('cyber_active_coupon');
  renderizarCupones();
  renderizarCarrito();
  mostrarToast('Cupón desactivado');
}

function copiarCodigo(code) {
  navigator.clipboard?.writeText(code);
  mostrarToast(`Código ${code} copiado al portapapeles`);
}

function abrirRuleta() {
  const overlay = document.getElementById('temu-wheel-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function cerrarRuletaEIrACupones() {
  const overlay = document.getElementById('temu-wheel-overlay');
  if (overlay) overlay.classList.add('hidden');
  irACupones();
}

function lanzarConfeti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const colores = ['#2563eb', '#15803d', '#f59e0b', '#1c1e21', '#3b82f6'];
  const piezas = Array.from({ length: 65 }, () => ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.7) * 10,
    size: Math.random() * 6 + 4,
    color: colores[Math.floor(Math.random() * colores.length)],
    life: 70
  }));

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let vivos = false;
    piezas.forEach(p => {
      if (p.life <= 0) return;
      vivos = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.life -= 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (vivos) requestAnimationFrame(animar);
  }
  animar();
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

  if (!canvas) return;
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
      const targetMod = (270 - (winIndex * sliceDeg + sliceDeg / 2) + 360) % 360;
      const delta = ((targetMod - (currentRotation % 360)) + 360) % 360;
      currentRotation += 360 * 5 + delta;
      canvas.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        isSpinning = false;
        const premio = WHEEL_PRIZES[winIndex];
        window.cuponGanado = premio.code;

        prizeText.textContent = premio.label;
        codeText.textContent = premio.code;
        resultBox.classList.add('active');
        lanzarConfeti();

        const nuevoCupon = {
          code: premio.code,
          type: premio.type,
          discountPct: premio.discountPct,
          discountAmount: premio.discountAmount,
          minPurchase: premio.minPurchase,
          freeShipping: premio.freeShipping,
          title: premio.label,
          desc: premio.desc,
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
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(p.label, radius - 16, 5);
    ctx.restore();
  });
}