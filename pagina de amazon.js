let productos = [];
let carrito = [];
let categoriaSeleccionada = 'Todas';
let disenoSeleccionadoIndex = 0;

// Datos de respaldo por si se ejecuta localmente sin un servidor
const fallbackProductos = [
  {
    id: 1,
    nombre: "Consola Next-Gen Pro 4K",
    descripcion: "Consola de última generación con soporte para Ray Tracing y SSD de 1TB.",
    categoria: "Consolas",
    precio: 499.99,
    disenos: [
      { nombre: "Edición Cyber Dark", imagen: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800" },
      { nombre: "Edición Neon Edition", imagen: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800" }
    ]
  },
  {
    id: 2,
    nombre: "Mando Pro Wireless RGB",
    descripcion: "Mando inalámbrico con sensores Hall anti-drift y gatillos adaptativos.",
    categoria: "Periféricos RGB",
    precio: 79.99,
    disenos: [
      { nombre: "Edición Cyber Dark", imagen: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=800" },
      { nombre: "Edición Neon Edition", imagen: "https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=800" }
    ]
  },
  {
    id: 3,
    nombre: "Headset Surround 7.1 Pro",
    descripcion: "Audífonos con cancelación de ruido activa y sonido espacial 7.1.",
    categoria: "Periféricos RGB",
    precio: 119.50,
    disenos: [
      { nombre: "Edición Cyber Dark", imagen: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800" },
      { nombre: "Edición Neon Edition", imagen: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800" }
    ]
  },
  {
    id: 4,
    nombre: "Silla Gamer Ergonómica XL",
    descripcion: "Silla ergonómica con reclinación de 180° y almohadilla de gel frío.",
    categoria: "Sillas & Setup",
    precio: 249.00,
    disenos: [
      { nombre: "Edición Cyber Dark", imagen: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800" },
      { nombre: "Edición Neon Edition", imagen: "https://images.unsplash.com/photo-1580481072645-022f9a6d83d0?w=800" }
    ]
  }
];

// Cargar productos desde JSON
async function cargarProductos() {
  try {
    const res = await fetch('productos.json');
    if (!res.ok) throw new Error('No se pudo leer productos.json');
    productos = await res.json();
  } catch (e) {
    console.warn('Cargando respaldo en memoria local...');
    productos = fallbackProductos;
  }
  renderizarProductos(productos);
}

// Renderizar tarjetas de productos
function renderizarProductos(lista) {
  const container = document.getElementById('products-container');
  container.innerHTML = lista.length === 0 ? "<p>No hay productos disponibles.</p>" : "";

  lista.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const primerDiseno = p.disenos && p.disenos[0] ? p.disenos[0].imagen : '';

    card.innerHTML = `
      <div onclick="abrirDetalle(${p.id})">
        <img src="${primerDiseno}" class="product-img" alt="${p.nombre}">
        <div class="product-title">${p.nombre}</div>
        <div style="color:#aaa; font-size:12px; margin-bottom:8px;">${p.categoria}</div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="product-price">$${p.precio.toFixed(2)}</span>
        <button class="btn-add" onclick="agregarAlCarrito(${p.id})">Agregar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Vista de detalle con variante seleccionable
function abrirDetalle(id) {
  const p = productos.find(prod => prod.id === id);
  if (!p) return;

  disenoSeleccionadoIndex = 0;

  document.getElementById('detail-title').innerText = p.nombre;
  document.getElementById('detail-category').innerText = p.categoria;
  document.getElementById('detail-price').innerText = `$${p.precio.toFixed(2)}`;
  document.getElementById('detail-desc').innerText = p.descripcion;
  
  const disenoInicial = p.disenos[0];
  document.getElementById('detail-img').src = disenoInicial.imagen;
  document.getElementById('selected-design-name').innerText = disenoInicial.nombre;

  // Renderizar miniaturas de diseños
  const containerDisenos = document.getElementById('detail-designs');
  containerDisenos.innerHTML = "";

  if (p.disenos && p.disenos.length > 0) {
    p.disenos.forEach((diseno, index) => {
      const thumb = document.createElement('img');
      thumb.src = diseno.imagen;
      thumb.className = `design-thumb ${index === 0 ? 'active' : ''}`;
      thumb.title = diseno.nombre;

      thumb.onclick = () => {
        disenoSeleccionadoIndex = index;
        document.getElementById('detail-img').src = diseno.imagen;
        document.getElementById('selected-design-name').innerText = diseno.nombre;

        document.querySelectorAll('.design-thumb').forEach((t, i) => {
          t.classList.toggle('active', i === index);
        });
      };

      containerDisenos.appendChild(thumb);
    });
  }

  document.getElementById('detail-add-btn').onclick = () => {
    agregarAlCarritoConDiseno(p.id, disenoSeleccionadoIndex);
  };

  document.getElementById('home-view').classList.remove('active');
  document.getElementById('product-detail-view').classList.add('active');
}

function mostrarPaginaInicio() {
  document.getElementById('product-detail-view').classList.remove('active');
  document.getElementById('home-view').classList.add('active');
}

// Filtro de búsqueda y categorías
function filtrarProductos() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const filtrados = productos.filter(p => {
    const matchCat = categoriaSeleccionada === 'Todas' || p.categoria === categoriaSeleccionada;
    const matchName = p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
    return matchCat && matchName;
  });
  renderizarProductos(filtrados);
}

function filtrarCategoria(cat, btn) {
  categoriaSeleccionada = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtrarProductos();
}

// Operaciones del Carrito
function agregarAlCarrito(id) {
  agregarAlCarritoConDiseno(id, 0);
}

function agregarAlCarritoConDiseno(id, indexDiseno) {
  const p = productos.find(prod => prod.id === id);
  if (!p) return;

  const disenoElegido = (p.disenos && p.disenos[indexDiseno]) ? p.disenos[indexDiseno] : p.disenos[0];
  const itemExistente = carrito.find(i => i.id === id && i.disenoNombre === disenoElegido.nombre);

  if (itemExistente) {
    itemExistente.cant++;
  } else {
    carrito.push({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      imagen: disenoElegido.imagen,
      disenoNombre: disenoElegido.nombre,
      cant: 1
    });
  }

  actualizarCarrito();
  toggleCarrito(true);
}

function actualizarCarrito() {
  const container = document.getElementById('cart-items-container');
  container.innerHTML = carrito.length === 0 ? "<p>El carrito está vacío.</p>" : "";

  let total = 0;
  let count = 0;

  carrito.forEach((item, index) => {
    total += item.precio * item.cant;
    count += item.cant;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.imagen}">
      <div style="flex:1;">
        <div style="font-weight:bold; font-size:13px;">${item.nombre}</div>
        <div style="color:#aaa; font-size:11px;">${item.disenoNombre}</div>
        <div style="color:var(--cyan); font-size:12px;">$${item.precio.toFixed(2)} x ${item.cant}</div>
      </div>
      <button onclick="eliminarDelCarrito(${index})" style="background:red; border:none; color:white; padding:2px 6px; border-radius:3px; cursor:pointer;">X</button>
    `;
    container.appendChild(div);
  });

  document.getElementById('cart-count').innerText = count;
  document.getElementById('cart-total').innerText = total.toFixed(2);
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarCarrito();
}

function toggleCarrito(open) {
  const drawer = document.getElementById('cart-drawer');
  if (open) drawer.classList.add('open');
  else drawer.classList.toggle('open');
}

function vaciarCarrito() {
  if (carrito.length === 0) return alert("Tu carrito está vacío.");
  alert("¡Gracias por tu compra!");
  carrito = [];
  actualizarCarrito();
  toggleCarrito();
}

// Bucle automático del Carrusel
let currentSlide = 0;
setInterval(() => {
  const slides = document.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;
  slides[currentSlide].classList.remove('active');
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].classList.add('active');
}, 4000);

// Inicializar la carga de datos
cargarProductos();