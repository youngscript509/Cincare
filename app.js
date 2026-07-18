// ============================================================
// CIN'CARE BEAUTY — Application boutique (vanilla JS + Firestore)
// ============================================================

// ---------- Config boutique (fallback si "config/boutique" absent) ----------
let SHOP_CONFIG = {
  whatsapp: '50948599749', // numéro WhatsApp par défaut (voir doc config/boutique dans Firestore)
  nomBoutique: "Cin'care Beauty",
  slogan: 'Glow. Care. Love Yourself.'
};

// ---------- État local (persisté en localStorage) ----------
const State = {
  produits: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem('cc_cart') || '[]'),
  favs: JSON.parse(localStorage.getItem('cc_favs') || '[]'),
  points: parseInt(localStorage.getItem('cc_points') || '0', 10),
  orders: JSON.parse(localStorage.getItem('cc_orders') || '[]'),
  activeCategory: 'all',
  searchTerm: '',
  currentProduct: null,
  lastSpinDate: localStorage.getItem('cc_lastSpin') || null
};

function persist() {
  localStorage.setItem('cc_cart', JSON.stringify(State.cart));
  localStorage.setItem('cc_favs', JSON.stringify(State.favs));
  localStorage.setItem('cc_points', String(State.points));
  localStorage.setItem('cc_orders', JSON.stringify(State.orders));
}

// ---------- Utils ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => (n || 0).toLocaleString('fr-FR') + ' HTG';

function showToast(text, emoji = '✨') {
  const t = $('#toast');
  t.querySelector('.em').textContent = emoji;
  $('#toastText').textContent = text;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove('show'), 2400);
}

function vibrate(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ---------- Overlay / Sheets ----------
const overlay = $('#overlay');
let openSheetEl = null;

function openSheet(id) {
  closeSheet();
  const el = document.getElementById(id);
  overlay.classList.add('open');
  el.classList.add('open');
  openSheetEl = el;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  if (openSheetEl) openSheetEl.classList.remove('open');
  overlay.classList.remove('open');
  openSheetEl = null;
  document.body.style.overflow = '';
}
overlay.addEventListener('click', closeSheet);
$$('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));

// ---------- Confetti (léger, canvas natif) ----------
function fireConfetti() {
  const canvas = $('#confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#e0577a', '#ff6f91', '#d4af6a', '#f0d494', '#faf3ea'];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    r: 4 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 3,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * 360,
    vr: -6 + Math.random() * 12
  }));
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      ctx.restore();
    });
    frame++;
    if (alive && frame < 150) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

// ============================================================
// GAMIFICATION — Points fidélité
// ============================================================
const LOYALTY_LEVELS = [
  { min: 0, label: 'Membre Glow', icon: '🌸' },
  { min: 200, label: 'Glow Silver', icon: '✨' },
  { min: 500, label: 'Glow Gold', icon: '👑' },
  { min: 1000, label: 'Glow Icon', icon: '💎' }
];

function updateLoyaltyUI() {
  const pts = State.points;
  let level = LOYALTY_LEVELS[0];
  let next = LOYALTY_LEVELS[1];
  for (let i = 0; i < LOYALTY_LEVELS.length; i++) {
    if (pts >= LOYALTY_LEVELS[i].min) { level = LOYALTY_LEVELS[i]; next = LOYALTY_LEVELS[i + 1]; }
  }
  $('#loyaltyLabel').textContent = level.label;
  $('#loyaltyPts').textContent = `${pts} pts`;
  $('#loyaltyRing').textContent = level.icon;
  let pct = 100;
  if (next) {
    pct = Math.min(100, Math.round(((pts - level.min) / (next.min - level.min)) * 100));
  }
  $('#loyaltyFill').style.width = pct + '%';
  $('#loyaltyRing').style.setProperty('--pct', pct + '%');
}

function addPoints(n) {
  State.points += n;
  persist();
  updateLoyaltyUI();
}

// ============================================================
// PRODUITS — Chargement Firestore + rendu
// ============================================================
function loadConfig() {
  db.collection('config').doc('boutique').get().then((doc) => {
    if (doc.exists) {
      SHOP_CONFIG = { ...SHOP_CONFIG, ...doc.data() };
    }
  }).catch(() => {});
}

function loadProducts() {
  db.collection('produits')
    .where('actif', '==', true)
    .orderBy('ordre', 'asc')
    .onSnapshot((snap) => {
      State.produits = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      buildCategories();
      renderProducts();
      renderFavGrid();
    }, (err) => {
      console.error('Erreur chargement produits', err);
      $('#productGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">⚠️</div>Impossible de charger les produits.<br>Vérifie ta connexion.</div>`;
    });
}

function buildCategories() {
  const cats = [...new Set(State.produits.map((p) => p.categorie).filter(Boolean))];
  State.categories = cats;
  const row = $('#chipsRow');
  row.innerHTML = `<div class="chip ${State.activeCategory === 'all' ? 'active' : ''}" data-cat="all">✨ Tout</div>`;
  cats.forEach((c) => {
    row.innerHTML += `<div class="chip ${State.activeCategory === c ? 'active' : ''}" data-cat="${c}">${c}</div>`;
  });
  row.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      State.activeCategory = chip.dataset.cat;
      row.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderProducts();
    });
  });
}

function getFilteredProducts() {
  let list = State.produits;
  if (State.activeCategory !== 'all') list = list.filter((p) => p.categorie === State.activeCategory);
  if (State.searchTerm.trim()) {
    const q = State.searchTerm.toLowerCase();
    list = list.filter((p) => (p.nom || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }
  return list;
}

function productCardHTML(p, i) {
  const isFav = State.favs.includes(p.id);
  const lowStock = typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3;
  const outStock = typeof p.stock === 'number' && p.stock <= 0;
  return `
    <div class="card" style="animation-delay:${i * 0.05}s" data-id="${p.id}">
      <div class="imgbox">
        ${p.badge ? `<span class="badge ${p.badge}">${p.badge}</span>` : ''}
        <div class="fav ${isFav ? 'on' : ''}" data-fav="${p.id}">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1 4 2.5C10.5 6 12 5 14 5c3.5 0 5.5 3.5 3.5 7.5C19.5 16.65 12 21 12 21z"/></svg>
        </div>
        ${p.imageURL
          ? `<img src="${p.imageURL}" alt="${p.nom}" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('.ph').style.display='flex';">`
          : ''}
        <div class="ph" style="${p.imageURL ? 'display:none' : 'display:flex'}">🌸</div>
      </div>
      <div class="info">
        <div class="cat">${p.categorie || ''}</div>
        <div class="nom">${p.nom || 'Produit'}</div>
        <div class="price-row">
          <div class="prix">${fmt(p.prix)}</div>
          <button class="add-btn" data-quickadd="${p.id}" ${outStock ? 'disabled style="opacity:.4"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        ${lowStock ? `<div class="stock-low">Plus que ${p.stock} en stock !</div>` : ''}
        ${outStock ? `<div class="stock-low">Rupture de stock</div>` : ''}
      </div>
    </div>`;
}

function renderProducts() {
  const list = getFilteredProducts();
  const grid = $('#productGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">🔍</div>Aucun produit trouvé.<br>Essaie une autre recherche.</div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => productCardHTML(p, i)).join('');
  attachCardEvents(grid);
}

function attachCardEvents(container) {
  container.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav]') || e.target.closest('[data-quickadd]')) return;
      openProductDetail(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(btn.dataset.fav);
    });
  });
  container.querySelectorAll('[data-quickadd]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = State.produits.find((x) => x.id === btn.dataset.quickadd);
      if (p) { addToCart(p, 1); vibrate(); }
    });
  });
}

// ---------- Favoris ----------
function toggleFav(id) {
  const idx = State.favs.indexOf(id);
  if (idx >= 0) { State.favs.splice(idx, 1); showToast('Retiré des favoris', '💔'); }
  else { State.favs.push(id); showToast('Ajouté aux favoris', '💖'); vibrate(); }
  persist();
  updateFavUI();
  renderProducts();
  renderFavGrid();
}
function updateFavUI() {
  const n = State.favs.length;
  $('#favCount').style.display = n ? 'flex' : 'none';
  $('#favCount').textContent = n;
}
function renderFavGrid() {
  const list = State.produits.filter((p) => State.favs.includes(p.id));
  const grid = $('#favGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="fav-empty" style="grid-column:1/-1"><div style="font-size:36px;margin-bottom:10px;">💗</div>Aucun favori pour l'instant.<br>Tape le cœur sur un produit pour le sauvegarder.</div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => productCardHTML(p, i)).join('');
  attachCardEvents(grid);
}

// ---------- Détail produit ----------
function openProductDetail(id) {
  const p = State.produits.find((x) => x.id === id);
  if (!p) return;
  State.currentProduct = p;
  $('#pdImg').src = p.imageURL || '';
  $('#pdCat').textContent = p.categorie || '';
  $('#pdName').textContent = p.nom || '';
  $('#pdPrice').innerHTML = fmt(p.prix) + (p.prixUSD ? ` <small>≈ $${p.prixUSD}</small>` : '');
  $('#pdDesc').textContent = p.description || 'Aucune description disponible.';
  $('#pdQty').textContent = '1';
  const outStock = typeof p.stock === 'number' && p.stock <= 0;
  $('#pdStockTxt').textContent = outStock ? 'Rupture de stock' : (typeof p.stock === 'number' ? `${p.stock} en stock` : '');
  $('#pdAddBtn').disabled = outStock;
  $('#pdAddBtn').style.opacity = outStock ? '.5' : '1';
  openSheet('sheetProduct');
}
$('#pdMinus').addEventListener('click', () => {
  const el = $('#pdQty');
  el.textContent = Math.max(1, parseInt(el.textContent, 10) - 1);
});
$('#pdPlus').addEventListener('click', () => {
  const el = $('#pdQty');
  el.textContent = parseInt(el.textContent, 10) + 1;
});
$('#pdAddBtn').addEventListener('click', () => {
  if (!State.currentProduct) return;
  const qty = parseInt($('#pdQty').textContent, 10);
  addToCart(State.currentProduct, qty);
  closeSheet();
  vibrate();
});

// ============================================================
// PANIER
// ============================================================
function addToCart(product, qty = 1) {
  const existing = State.cart.find((c) => c.produitId === product.id);
  if (existing) existing.qty += qty;
  else {
    State.cart.push({
      produitId: product.id,
      nom: product.nom,
      prix: product.prix,
      imageURL: product.imageURL || '',
      qty
    });
  }
  persist();
  updateCartUI();
  showToast(`${product.nom} ajouté au panier`, '🛍️');
}

function updateCartQty(produitId, delta) {
  const item = State.cart.find((c) => c.produitId === produitId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) State.cart = State.cart.filter((c) => c.produitId !== produitId);
  persist();
  updateCartUI();
  renderCartSheet();
}
function removeFromCart(produitId) {
  State.cart = State.cart.filter((c) => c.produitId !== produitId);
  persist();
  updateCartUI();
  renderCartSheet();
}

function cartTotals() {
  const sousTotal = State.cart.reduce((sum, c) => sum + c.prix * c.qty, 0);
  return { sousTotal, total: sousTotal };
}

function updateCartUI() {
  const count = State.cart.reduce((s, c) => s + c.qty, 0);
  const fab = $('#cartFab');
  const fabN = $('#cartFabN');
  const topN = $('#cartCountTop');
  if (count > 0) {
    fab.classList.remove('hide');
    fabN.textContent = count;
    topN.style.display = 'flex';
    topN.textContent = count;
  } else {
    fab.classList.add('hide');
    topN.style.display = 'none';
  }
}

function renderCartSheet() {
  const list = $('#cartList');
  const summary = $('#cartSummary');
  const checkoutBtn = $('#btnCheckout');
  if (!State.cart.length) {
    list.innerHTML = `<div class="fav-empty"><div style="font-size:36px;margin-bottom:10px;">🛍️</div>Ton panier est vide.<br>Ajoute quelques pépites beauté !</div>`;
    summary.style.display = 'none';
    checkoutBtn.style.display = 'none';
    return;
  }
  list.innerHTML = State.cart.map((c) => `
    <div class="cart-item" data-id="${c.produitId}">
      <img src="${c.imageURL}" onerror="this.style.opacity=0">
      <div class="ci-info">
        <div class="nm">${c.nom}</div>
        <div class="pr">${fmt(c.prix)}</div>
      </div>
      <div class="ci-qty">
        <button data-dec="${c.produitId}">−</button>
        <span class="n">${c.qty}</span>
        <button data-inc="${c.produitId}">+</button>
      </div>
      <div class="ci-del" data-del="${c.produitId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => updateCartQty(b.dataset.inc, 1)));
  list.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => updateCartQty(b.dataset.dec, -1)));
  list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeFromCart(b.dataset.del)));

  const { sousTotal, total } = cartTotals();
  $('#sumSubtotal').textContent = fmt(sousTotal);
  $('#sumTotal').textContent = fmt(total);
  summary.style.display = 'block';
  checkoutBtn.style.display = 'flex';
}

$('#btnCartTop').addEventListener('click', () => { renderCartSheet(); openSheet('sheetCart'); });
$('#cartFab').addEventListener('click', () => { renderCartSheet(); openSheet('sheetCart'); });
$('#btnFav').addEventListener('click', () => { renderFavGrid(); openSheet('sheetFav'); });

$('#btnCheckout').addEventListener('click', () => {
  openSheet('sheetCheckout');
});

// ============================================================
// CHECKOUT — Firestore + WhatsApp
// ============================================================
let lastOrderData = null;

function genOrderNumber() {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `CC-${n}`;
}

$('#btnConfirmOrder').addEventListener('click', async () => {
  const nom = $('#ckNom').value.trim();
  const tel = $('#ckTel').value.trim();
  const adresse = $('#ckAdresse').value.trim();
  const note = $('#ckNote').value.trim();

  if (!nom || !tel || !adresse) {
    showToast('Remplis nom, téléphone et adresse', '⚠️');
    return;
  }
  if (!State.cart.length) {
    showToast('Ton panier est vide', '⚠️');
    return;
  }

  const btn = $('#btnConfirmOrder');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours...';

  const { sousTotal, total } = cartTotals();
  const numero = genOrderNumber();
  const orderData = {
    numero,
    client: { nom, telephone: tel, adresse, note },
    items: State.cart.map((c) => ({ produitId: c.produitId, nom: c.nom, prix: c.prix, qty: c.qty, imageURL: c.imageURL })),
    sousTotal,
    total,
    statut: 'en_attente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('commandes').add(orderData);
  } catch (err) {
    console.error('Erreur Firestore commande', err);
    // On continue quand même vers WhatsApp même si Firestore échoue (résilience offline)
  }

  const pointsGagnes = Math.max(5, Math.round(total / 100));
  addPoints(pointsGagnes);

  State.orders.unshift({ numero, total, items: orderData.items, date: new Date().toISOString(), statut: 'en_attente' });
  State.cart = [];
  persist();
  updateCartUI();

  lastOrderData = { ...orderData, numero, total };
  btn.disabled = false;
  btn.textContent = 'Confirmer ma commande';

  $('#successOrderNum').textContent = numero;
  $('#pointsEarnedTxt').textContent = `+${pointsGagnes} points`;
  closeSheet();
  setTimeout(() => { openSheet('sheetSuccess'); fireConfetti(); vibrate(30); }, 150);
});

function buildWhatsAppMessage(order) {
  let msg = `Bonjour Cin'care Beauty 🌸\nJe souhaite finaliser ma commande *${order.numero}*\n\n`;
  order.items.forEach((it) => {
    msg += `• ${it.nom} x${it.qty} — ${fmt(it.prix * it.qty)}\n`;
  });
  msg += `\n*Total : ${fmt(order.total)}*\n\n`;
  msg += `📍 Nom : ${order.client.nom}\n`;
  msg += `📞 Téléphone : ${order.client.telephone}\n`;
  msg += `🏠 Adresse : ${order.client.adresse}\n`;
  if (order.client.note) msg += `📝 Note : ${order.client.note}\n`;
  return msg;
}

$('#btnGoWhatsapp').addEventListener('click', () => {
  if (!lastOrderData) return;
  const msg = buildWhatsAppMessage(lastOrderData);
  const url = `https://wa.me/${SHOP_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
});

// ============================================================
// HISTORIQUE COMMANDES (local)
// ============================================================
function renderOrdersList() {
  const el = $('#ordersList');
  if (!State.orders.length) {
    el.innerHTML = `<div class="fav-empty"><div style="font-size:36px;margin-bottom:10px;">📦</div>Aucune commande pour le moment.</div>`;
    return;
  }
  const statutLabels = {
    en_attente: ['⏳ En attente', '#d4af6a'],
    confirmee: ['✅ Confirmée', '#6fbf8a'],
    preparation: ['📦 En préparation', '#e0577a'],
    livree: ['🎉 Livrée', '#6fbf8a'],
    annulee: ['✕ Annulée', '#999']
  };
  el.innerHTML = State.orders.map((o) => {
    const [label, color] = statutLabels[o.statut] || statutLabels.en_attente;
    const date = new Date(o.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <div style="background:rgba(255,255,255,.03); border:1px solid rgba(212,175,106,.15); border-radius:14px; padding:14px; margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:700;color:var(--or-clair);font-size:13px;">${o.numero}</span>
          <span style="font-size:11px;font-weight:600;color:${color}">${label}</span>
        </div>
        <div style="font-size:11px;color:var(--texte-fade);margin-bottom:8px;">${date} · ${o.items.length} article(s)</div>
        <div style="font-weight:700;color:var(--creme);font-family:var(--font-display);">${fmt(o.total)}</div>
      </div>`;
  }).join('');
}

// ============================================================
// NAVIGATION
// ============================================================
$$('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    $$('.nav-item').forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
    const view = item.dataset.view;
    if (view === 'fav') { renderFavGrid(); openSheet('sheetFav'); }
    else if (view === 'cart') { renderCartSheet(); openSheet('sheetCart'); }
    else if (view === 'orders') { renderOrdersList(); openSheet('sheetOrders'); }
    else closeSheet();
  });
});

$('#searchInput').addEventListener('input', (e) => {
  State.searchTerm = e.target.value;
  renderProducts();
});
$('#clearFilters').addEventListener('click', () => {
  State.searchTerm = '';
  State.activeCategory = 'all';
  $('#searchInput').value = '';
  $$('.chip').forEach((c) => c.classList.remove('active'));
  $('.chip[data-cat="all"]').classList.add('active');
  renderProducts();
});
$('#heroGo').addEventListener('click', () => {
  document.querySelector('.section-title').scrollIntoView({ behavior: 'smooth' });
});

// ============================================================
// ROUE GLOW (gamification quotidienne)
// ============================================================
const WHEEL_PRIZES = [
  { label: '10 pts', pts: 10, color: '#3a1c28' },
  { label: '5% Off', pts: 0, color: '#c9497a' },
  { label: '20 pts', pts: 20, color: '#3a1c28' },
  { label: 'Réessaie', pts: 0, color: '#2a1b23' },
  { label: '50 pts', pts: 50, color: '#a8823f' },
  { label: '10% Off', pts: 0, color: '#e0577a' },
  { label: '15 pts', pts: 15, color: '#3a1c28' },
  { label: 'Jackpot 100', pts: 100, color: '#d4af6a' }
];

function drawWheel(rotation = 0) {
  const canvas = $('#wheelCanvas');
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 130;
  const n = WHEEL_PRIZES.length;
  const arc = (2 * Math.PI) / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, i * arc, (i + 1) * arc);
    ctx.closePath();
    ctx.fillStyle = WHEEL_PRIZES[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,106,.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.rotate(i * arc + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f0d494';
    ctx.font = '600 12px Poppins, sans-serif';
    ctx.fillText(WHEEL_PRIZES[i].label, r - 14, 5);
    ctx.restore();
  }
  ctx.restore();
  // Centre doré
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 22);
  grad.addColorStop(0, '#f0d494');
  grad.addColorStop(1, '#a8823f');
  ctx.fillStyle = grad;
  ctx.fill();
}

function isSameDay(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString();
}

let wheelRotation = 0;
let spinning = false;

$('#wheelTeaser').addEventListener('click', () => {
  drawWheel(wheelRotation);
  openSheet('sheetWheel');
  const already = isSameDay(State.lastSpinDate);
  $('#btnSpin').disabled = already;
  $('#btnSpin').textContent = already ? 'Reviens demain !' : 'Faire tourner la roue';
  $('#btnSpin').style.opacity = already ? '.5' : '1';
});

$('#btnSpin').addEventListener('click', () => {
  if (spinning || isSameDay(State.lastSpinDate)) return;
  spinning = true;
  const n = WHEEL_PRIZES.length;
  const arc = (2 * Math.PI) / n;
  const winIndex = Math.floor(Math.random() * n);
  // On veut que le segment gagnant s'arrête sous le pointeur (en haut, -90deg / -PI/2)
  const targetAngle = -(Math.PI / 2) - (winIndex * arc + arc / 2);
  const spins = 6; // tours complets
  const finalRotation = targetAngle + spins * 2 * Math.PI;

  const duration = 3800;
  const start = performance.now();
  const initial = wheelRotation;

  function animate(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 4); // ease-out quart
    wheelRotation = initial + (finalRotation - initial) * eased;
    drawWheel(wheelRotation);
    if (t < 1) requestAnimationFrame(animate);
    else {
      spinning = false;
      const prize = WHEEL_PRIZES[winIndex];
      State.lastSpinDate = new Date().toISOString();
      localStorage.setItem('cc_lastSpin', State.lastSpinDate);
      if (prize.pts > 0) {
        addPoints(prize.pts);
        showToast(`Tu as gagné ${prize.label} !`, '🎉');
      } else if (prize.label.includes('Off')) {
        showToast(`Tu as gagné ${prize.label} sur ta prochaine commande !`, '🎁');
      } else {
        showToast('Pas de chance cette fois, reviens demain !', '🍀');
      }
      fireConfetti();
      vibrate(40);
      $('#btnSpin').disabled = true;
      $('#btnSpin').textContent = 'Reviens demain !';
      $('#btnSpin').style.opacity = '.5';
    }
  }
  requestAnimationFrame(animate);
});

// ============================================================
// INIT
// ============================================================
function init() {
  updateLoyaltyUI();
  updateFavUI();
  updateCartUI();
  drawWheel(0);
  loadConfig();
  loadProducts();

  // Enregistrement service worker (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}
init();
