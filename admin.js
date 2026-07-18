// ============================================================
// CIN'CARE BEAUTY — Espace Admin (Firebase Auth + Firestore)
// ============================================================

const auth = firebase.auth();
let allOrders = [];
let allProducts = [];
let currentOrderFilter = 'all';
let editingProductId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmt = (n) => (n || 0).toLocaleString('fr-FR') + ' HTG';

function showToast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============================================================
// AUTH
// ============================================================
auth.onAuthStateChanged((user) => {
  if (user) {
    $('#loginScreen').style.display = 'none';
    $('#dashboard').style.display = 'block';
    $('#fabAdd').style.display = 'flex';
    initAdmin();
  } else {
    $('#loginScreen').style.display = 'flex';
    $('#dashboard').style.display = 'none';
    $('#fabAdd').style.display = 'none';
  }
});

$('#btnLogin').addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const pass = $('#loginPass').value;
  const errEl = $('#loginError');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Remplis email et mot de passe'; return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    errEl.textContent = "Identifiants incorrects ou compte inexistant.";
    console.error(err);
  }
});
$('#loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnLogin').click(); });

$('#btnLogout').addEventListener('click', () => auth.signOut());

// ============================================================
// TABS
// ============================================================
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.view').forEach((v) => v.classList.remove('active'));
    $(`#view${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
  });
});

// ============================================================
// INIT — écoute Firestore en temps réel
// ============================================================
function initAdmin() {
  db.collection('commandes').orderBy('createdAt', 'desc').onSnapshot((snap) => {
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStats();
    renderOrders();
  }, (err) => console.error('Erreur commandes', err));

  db.collection('produits').orderBy('ordre', 'asc').onSnapshot((snap) => {
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStats();
    renderProducts();
  }, (err) => console.error('Erreur produits', err));
}

function renderStats() {
  $('#statOrders').textContent = allOrders.length;
  $('#statPending').textContent = allOrders.filter((o) => o.statut === 'en_attente').length;
  $('#statProducts').textContent = allProducts.length;
}

// ============================================================
// COMMANDES
// ============================================================
$$('#orderFilters .fchip').forEach((chip) => {
  chip.addEventListener('click', () => {
    $$('#orderFilters .fchip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentOrderFilter = chip.dataset.status;
    renderOrders();
  });
});

function renderOrders() {
  const container = $('#ordersContainer');
  let list = allOrders;
  if (currentOrderFilter !== 'all') list = list.filter((o) => o.statut === currentOrderFilter);

  if (!list.length) {
    container.innerHTML = `<div class="empty">📭 Aucune commande dans cette catégorie.</div>`;
    return;
  }

  container.innerHTML = list.map((o) => {
    const date = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    const itemsHTML = (o.items || []).map((it) => `<div><span>${it.nom} ×${it.qty}</span><span>${fmt(it.prix * it.qty)}</span></div>`).join('');
    const tel = (o.client && o.client.telephone || '').replace(/\D/g, '');
    return `
      <div class="order-card">
        <div class="order-top">
          <div><div class="num">${o.numero || o.id}</div><div class="date">${date}</div></div>
          <span class="status-pill ${o.statut}">${statusLabel(o.statut)}</span>
        </div>
        <div class="order-client">
          <b>${o.client ? o.client.nom : '—'}</b> · ${o.client ? o.client.telephone : ''}<br>
          ${o.client ? o.client.adresse : ''}
          ${o.client && o.client.note ? `<br><i>Note : ${o.client.note}</i>` : ''}
        </div>
        <div class="order-items">${itemsHTML}</div>
        <div class="order-total"><span style="font-size:11.5px;color:var(--texte-fade)">Total</span><span class="t">${fmt(o.total)}</span></div>
        <select class="status-select" data-order="${o.id}">
          <option value="en_attente" ${o.statut === 'en_attente' ? 'selected' : ''}>⏳ En attente</option>
          <option value="confirmee" ${o.statut === 'confirmee' ? 'selected' : ''}>✅ Confirmée</option>
          <option value="preparation" ${o.statut === 'preparation' ? 'selected' : ''}>📦 En préparation</option>
          <option value="livree" ${o.statut === 'livree' ? 'selected' : ''}>🎉 Livrée</option>
          <option value="annulee" ${o.statut === 'annulee' ? 'selected' : ''}>✕ Annulée</option>
        </select>
        ${tel ? `<div class="wa-link" data-wa="${tel}">💬 Contacter sur WhatsApp</div>` : ''}
      </div>`;
  }).join('');

  container.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', () => updateOrderStatus(sel.dataset.order, sel.value));
  });
  container.querySelectorAll('[data-wa]').forEach((el) => {
    el.addEventListener('click', () => window.open(`https://wa.me/${el.dataset.wa}`, '_blank'));
  });
}

function statusLabel(s) {
  return { en_attente: 'En attente', confirmee: 'Confirmée', preparation: 'Préparation', livree: 'Livrée', annulee: 'Annulée' }[s] || s;
}

async function updateOrderStatus(id, statut) {
  try {
    await db.collection('commandes').doc(id).update({ statut, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Statut mis à jour ✅');
  } catch (err) {
    console.error(err);
    showToast('Erreur de mise à jour');
  }
}

// ============================================================
// PRODUITS
// ============================================================
function renderProducts() {
  const container = $('#productsContainer');
  if (!allProducts.length) {
    container.innerHTML = `<div class="empty">💄 Aucun produit. Ajoute-en un avec le bouton +</div>`;
    return;
  }
  container.innerHTML = allProducts.map((p) => `
    <div class="prod-row">
      ${p.imageURL ? `<img src="${p.imageURL}" onerror="this.style.display='none'">` : `<div class="ph">🌸</div>`}
      <div class="prod-info">
        <div class="nm">${p.nom || 'Sans nom'}</div>
        <div class="meta">${p.categorie || '—'} · Stock: ${typeof p.stock === 'number' ? p.stock : '—'}</div>
        <div class="pr">${fmt(p.prix)}</div>
      </div>
      <div class="prod-actions">
        <div class="toggle-active ${p.actif ? 'on' : ''}" data-toggle="${p.id}"><div class="dot"></div></div>
        <div style="display:flex;gap:6px;">
          <div class="icon-mini" data-edit="${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div class="icon-mini danger" data-del="${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', () => toggleProductActive(el.dataset.toggle));
  });
  container.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', () => openProductModal(el.dataset.edit));
  });
  container.querySelectorAll('[data-del]').forEach((el) => {
    el.addEventListener('click', () => deleteProduct(el.dataset.del));
  });
}

async function toggleProductActive(id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  try {
    await db.collection('produits').doc(id).update({ actif: !p.actif });
    showToast(p.actif ? 'Produit masqué' : 'Produit visible');
  } catch (err) { console.error(err); showToast('Erreur'); }
}

async function deleteProduct(id) {
  if (!confirm('Supprimer définitivement ce produit ?')) return;
  try {
    await db.collection('produits').doc(id).delete();
    showToast('Produit supprimé');
  } catch (err) { console.error(err); showToast('Erreur de suppression'); }
}

// ---------- Modal produit ----------
function openProductModal(id = null) {
  editingProductId = id;
  const p = id ? allProducts.find((x) => x.id === id) : null;
  $('#modalTitle').textContent = p ? 'Modifier le produit' : 'Nouveau produit';
  $('#mImageURL').value = p ? p.imageURL || '' : '';
  $('#mNom').value = p ? p.nom || '' : '';
  $('#mDescription').value = p ? p.description || '' : '';
  $('#mPrix').value = p ? p.prix || '' : '';
  $('#mPrixUSD').value = p ? p.prixUSD || '' : '';
  $('#mCategorie').value = p ? p.categorie || '' : '';
  $('#mStock').value = p ? (typeof p.stock === 'number' ? p.stock : '') : '';
  $('#mBadge').value = p ? p.badge || '' : '';
  $('#btnDeleteProduct').style.display = p ? 'block' : 'none';
  updateImgPreview();
  $('#modalProduct').classList.add('open');
}
function closeProductModal() {
  $('#modalProduct').classList.remove('open');
  editingProductId = null;
}
$('#fabAdd').addEventListener('click', () => openProductModal(null));
$('#closeModalProduct').addEventListener('click', closeProductModal);
$('#modalProduct').addEventListener('click', (e) => { if (e.target.id === 'modalProduct') closeProductModal(); });

function updateImgPreview() {
  const url = $('#mImageURL').value.trim();
  const img = $('#mImgPreview');
  const ph = $('#mImgPh');
  if (url) { img.src = url; img.style.display = 'block'; ph.style.display = 'none'; img.onerror = () => { img.style.display = 'none'; ph.style.display = 'block'; }; }
  else { img.style.display = 'none'; ph.style.display = 'block'; }
}
$('#mImageURL').addEventListener('input', updateImgPreview);

$('#btnSaveProduct').addEventListener('click', async () => {
  const nom = $('#mNom').value.trim();
  const prix = parseFloat($('#mPrix').value);
  if (!nom || isNaN(prix)) { showToast('Nom et prix sont obligatoires'); return; }

  const data = {
    nom,
    description: $('#mDescription').value.trim(),
    prix,
    prixUSD: $('#mPrixUSD').value ? parseFloat($('#mPrixUSD').value) : null,
    imageURL: $('#mImageURL').value.trim(),
    categorie: $('#mCategorie').value.trim(),
    stock: $('#mStock').value ? parseInt($('#mStock').value, 10) : 0,
    badge: $('#mBadge').value,
    actif: true
  };

  const btn = $('#btnSaveProduct');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  try {
    if (editingProductId) {
      await db.collection('produits').doc(editingProductId).update(data);
      showToast('Produit mis à jour ✅');
    } else {
      data.ordre = allProducts.length;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('produits').add(data);
      showToast('Produit ajouté ✅');
    }
    closeProductModal();
  } catch (err) {
    console.error(err);
    showToast('Erreur d\'enregistrement');
  }
  btn.disabled = false;
  btn.textContent = 'Enregistrer le produit';
});

$('#btnDeleteProduct').addEventListener('click', () => {
  if (!editingProductId) return;
  closeProductModal();
  deleteProduct(editingProductId);
});
