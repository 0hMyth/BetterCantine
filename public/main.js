// STATE
let currentUser = null;
let currentProfil = null;
let cart = [];
let isSignUp = false;
let menuData = null;

// AUTH
function toggleAuthMode() {
    isSignUp = !isSignUp;
    document.getElementById('authTitle').textContent = isSignUp ? 'Opret konto' : 'Log ind';
    document.getElementById('authBtn').textContent = isSignUp ? 'Opret konto' : 'Log ind';
    document.getElementById('toggleAuth').textContent = isSignUp
        ? 'Har du allerede en konto? Log ind her'
        : 'Har du ingen konto? Opret en her';
    document.getElementById('signupFields').classList.toggle('hidden', !isSignUp);
    document.getElementById('authError').textContent = '';
}

async function handleAuth() {
    var email = document.getElementById('emailInput').value.trim();
    var password = document.getElementById('passwordInput').value;
    var errorEl = document.getElementById('authError');
    errorEl.textContent = '';
    if (!email || !password) { errorEl.textContent = 'Udfyld email og adgangskode'; return; }

    if (isSignUp) {
        var fullName = document.getElementById('fullNameInput').value.trim();
        if (!fullName) { errorEl.textContent = 'Udfyld dit navn'; return; }
        var res = await fetchJSON('/api/signup', 'POST', { email: email, password: password, fullName: fullName });
        if (res.error) { errorEl.textContent = res.error; return; }
        errorEl.style.color = '#2ecc71';
        errorEl.textContent = 'Konto oprettet! Du kan nu logge ind.';
        toggleAuthMode();
    } else {
        var res = await fetchJSON('/api/signin', 'POST', { email: email, password: password });
        if (res.error) { errorEl.textContent = res.error; return; }
        currentUser = res;
        currentProfil = res;
        enterApp();
    }
}

function logOut() {
    currentUser = null; currentProfil = null; cart = [];
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('cartBar').style.display = 'none';
}

// CART CLICK DELEGATION
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('mainContent').addEventListener('click', function(e) {
        if (e.target.classList.contains('cart-btn')) {
            changeCart(e.target.dataset.id, parseInt(e.target.dataset.delta));
        }
        if (e.target.classList.contains('fjern-btn')) {
            adminFjernMenuItem(e.target.dataset.mid);
        }
        if (e.target.classList.contains('mark-btn')) {
            markPickedUp(e.target.dataset.oid);
        }
        if (e.target.classList.contains('disc-btn')) {
            setDiscount(e.target.dataset.did);
        }
    });
});

// APP INIT
function enterApp() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = currentProfil ? currentProfil.full_name : currentUser.email;
    document.getElementById('userRoleDisplay').textContent = (currentProfil && currentProfil.role === 'admin') ? '(Admin)' : '(Elev)';

    var nav = document.getElementById('navBar');
    nav.querySelectorAll('.admin-nav').forEach(function(b) { b.remove(); });

    if (currentProfil && currentProfil.role === 'admin') {
        var adminBtns = [
            { text: 'Administrer menu', section: 'adminMenuSection' },
            { text: 'Alle ordrer', section: 'adminOrdrerSection' },
            { text: 'Rabatter', section: 'adminDiscountSection' },
            { text: 'Statistik', section: 'adminStatsSection' }
        ];
        adminBtns.forEach(function(b) {
            var btn = document.createElement('button');
            btn.textContent = b.text;
            btn.classList.add('admin-nav');
            btn.dataset.section = b.section;
            btn.addEventListener('click', function() { showSection(b.section); });
            nav.appendChild(btn);
        });
    }
    showSection('buySection');
}

// NAVIGATION
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('nav button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.section === sectionId);
    });
    if (sectionId === 'buySection') loadBuySection();
    if (sectionId === 'reserveSection') loadReserveSection();
    if (sectionId === 'ordrerSection') loadMineOrdrer();
    if (sectionId === 'adminMenuSection') loadAdminMenu();
    if (sectionId === 'adminOrdrerSection') loadAdminOrdrer();
    if (sectionId === 'adminDiscountSection') loadDiscountView();
    if (sectionId === 'adminStatsSection') initStatsPanel();
}

// ════════════════════════════════════════════════════════
// STUDENT: BUY & RESERVE SECTIONS
// ════════════════════════════════════════════════════════

var buyMenuData = null;
var reserveMenuData = null;
var activeBuyCategory = null;
var activeReserveCategory = null;

async function loadBuySection() {
    var res = await fetchJSON('/api/menu');
    var statusBar = document.getElementById('buyStatusBar');
    var closedMsg = document.getElementById('buyClosedMsg');
    var content = document.getElementById('buyContent');
    var title = document.getElementById('buyTitle');

    if (res.erReservation) {
        // Canteen is closed
        statusBar.innerHTML = '<span class="dot dot-red"></span> Kantinen er lukket';
        closedMsg.classList.remove('hidden');
        content.classList.add('hidden');
        title.textContent = 'Køb - Kantinen er lukket';
    } else {
        // Canteen is open
        buyMenuData = res;
        statusBar.innerHTML = '<span class="dot dot-green"></span> Kantinen er åben (07:00-13:45) - ' + res.dato;
        closedMsg.classList.add('hidden');
        content.classList.remove('hidden');
        title.textContent = 'Køb - Menu for ' + res.dato;
        renderMenuPanel('buy', res.menu || [], activeBuyCategory);
    }
}

async function loadReserveSection() {
    var res = await fetchJSON('/api/menu');
    var statusBar = document.getElementById('reserveStatusBar');
    var openMsg = document.getElementById('reserveOpenMsg');
    var content = document.getElementById('reserveContent');
    var title = document.getElementById('reserveTitle');

    if (!res.erReservation) {
        // Canteen is open, no reservation needed right now
        statusBar.innerHTML = '<span class="dot dot-green"></span> Kantinen er åben lige nu';
        openMsg.classList.remove('hidden');
        content.classList.add('hidden');
        title.textContent = 'Reserver';
    } else {
        // Reservation period
        reserveMenuData = res;
        statusBar.innerHTML = '<span class="dot dot-yellow"></span> Reservationsperiode - reserver til <strong>' + res.dato + '</strong>';
        openMsg.classList.add('hidden');
        content.classList.remove('hidden');
        title.textContent = 'Reserver - Menu for ' + res.dato;
        renderMenuPanel('reserve', res.menu || [], activeReserveCategory);
    }
}

function getMenuDataForMode(mode) {
    return mode === 'buy' ? buyMenuData : reserveMenuData;
}

function renderMenuPanel(mode, menu, activeCategory) {
    var tabsId = mode === 'buy' ? 'buyCategoryTabs' : 'reserveCategoryTabs';
    var listId = mode === 'buy' ? 'buyItemList' : 'reserveItemList';
    var detailId = mode === 'buy' ? 'buyDetailPanel' : 'reserveDetailPanel';

    var tabsContainer = document.getElementById(tabsId);
    var listContainer = document.getElementById(listId);
    var detailPanel = document.getElementById(detailId);

    // Reset detail panel
    detailPanel.innerHTML = '<div class="detail-placeholder">Hold musen over en ret for at se detaljer</div>';

    // Build category list from menu
    var categories = [];
    var catMap = {};
    menu.forEach(function(item) {
        var fi = item.food_items;
        var cn = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : 'Andet';
        var cid = fi.category_id || 0;
        if (!catMap[cid]) {
            catMap[cid] = cn;
            categories.push({ id: cid, name: cn });
        }
    });

    // Render category tabs
    tabsContainer.innerHTML = '';
    var allTab = document.createElement('button');
    allTab.textContent = 'Alle';
    allTab.classList.add('category-tab');
    if (!activeCategory) allTab.classList.add('active');
    allTab.addEventListener('click', function() {
        if (mode === 'buy') activeBuyCategory = null; else activeReserveCategory = null;
        renderMenuPanel(mode, menu, null);
    });
    tabsContainer.appendChild(allTab);

    categories.forEach(function(cat) {
        var tab = document.createElement('button');
        tab.textContent = cat.name;
        tab.classList.add('category-tab');
        if (activeCategory === cat.id) tab.classList.add('active');
        tab.addEventListener('click', function() {
            if (mode === 'buy') activeBuyCategory = cat.id; else activeReserveCategory = cat.id;
            renderMenuPanel(mode, menu, cat.id);
        });
        tabsContainer.appendChild(tab);
    });

    // Filter by category
    var filtered = menu.filter(function(item) {
        var remaining = item.total_quantity - item.sold_quantity;
        if (remaining <= 0) return false;
        if (activeCategory === null) return true;
        return (item.food_items.category_id || 0) === activeCategory;
    });

    // Render list items
    listContainer.innerHTML = '';
    if (filtered.length === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Ingen retter tilgængelige i denne kategori.</p>';
        return;
    }

    filtered.forEach(function(item) {
        var fi = item.food_items;
        var remaining = item.total_quantity - item.sold_quantity;
        var discountAvail = item.discounted_quantity > 0;
        var inCart = cart.find(function(c) { return c.daily_menu_id === item.id; });
        var qty = inCart ? inCart.quantity : 0;

        var row = document.createElement('div');
        row.classList.add('menu-item-row');

        var priceHTML = '';
        if (discountAvail) {
            priceHTML = '<span class="original-price">' + Number(fi.base_price).toFixed(2) + ' DKK</span>' +
                '<span class="price discounted">' + Number(fi.discount_price).toFixed(2) + ' DKK</span>';
        } else {
            priceHTML = '<span class="price">' + Number(fi.base_price).toFixed(2) + ' DKK</span>';
        }

        row.innerHTML =
            '<div class="item-info">' +
                '<div class="item-name">' + fi.name + '</div>' +
                '<div class="item-desc">' + (fi.description || '') + '</div>' +
            '</div>' +
            '<div class="item-price-area">' +
                priceHTML +
                '<div class="item-stock">' + remaining + ' tilbage</div>' +
                (discountAvail ? '<span class="discount-badge">TILBUD</span>' : '') +
            '</div>' +
            '<div class="quantity-ctrl">' +
                '<button data-id="' + item.id + '" data-delta="-1" class="cart-btn">-</button>' +
                '<span id="qty-' + item.id + '">' + qty + '</span>' +
                '<button data-id="' + item.id + '" data-delta="1" class="cart-btn">+</button>' +
            '</div>';

        // Hover: show detail panel
        row.addEventListener('mouseenter', function() {
            showDetailPanel(detailId, fi);
            listContainer.querySelectorAll('.menu-item-row').forEach(function(r) { r.classList.remove('active-hover'); });
            row.classList.add('active-hover');
        });

        listContainer.appendChild(row);
    });
}

function showDetailPanel(panelId, fi) {
    var panel = document.getElementById(panelId);
    var allergens = fi.allergens || '';
    var isHalal = fi.is_halal;
    var extraInfo = fi.extra_info || '';

    // If no extra info at all, show just name + description
    var hasExtraInfo = allergens || isHalal !== undefined || extraInfo;

    var html = '<div class="detail-panel-content">';
    html += '<h3>' + fi.name + '</h3>';

    // Halal status
    if (isHalal === true) {
        html += '<div class="detail-row"><span class="detail-label">Halal:</span><span class="detail-halal-badge">Halal</span></div>';
    } else if (isHalal === false) {
        html += '<div class="detail-row"><span class="detail-label">Halal:</span><span class="detail-not-halal-badge">Ikke halal</span></div>';
    }

    // Allergens
    if (allergens) {
        var tags = allergens.split(',').map(function(a) {
            return '<span class="detail-allergen-tag">' + a.trim() + '</span>';
        }).join(' ');
        html += '<div class="detail-row"><span class="detail-label">Allergener:</span><span class="detail-value">' + tags + '</span></div>';
    } else {
        html += '<div class="detail-row"><span class="detail-label">Allergener:</span><span class="detail-value" style="color:var(--text-muted);">Ingen</span></div>';
    }

    // Price info
    html += '<div class="detail-row"><span class="detail-label">Pris:</span><span class="detail-value">' +
        Number(fi.base_price).toFixed(2) + ' DKK</span></div>';
    if (Number(fi.discount_price) > 0 && Number(fi.discount_price) < Number(fi.base_price)) {
        html += '<div class="detail-row"><span class="detail-label">Rabatpris:</span><span class="detail-value" style="color:var(--danger);font-weight:600;">' +
            Number(fi.discount_price).toFixed(2) + ' DKK</span></div>';
    }

    // Extra info
    if (extraInfo) {
        html += '<div class="detail-extra">' + extraInfo + '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
}

function findMenuItem(dailyMenuId) {
    var sources = [buyMenuData, reserveMenuData];
    for (var i = 0; i < sources.length; i++) {
        if (sources[i] && sources[i].menu) {
            var found = sources[i].menu.find(function(m) { return m.id === dailyMenuId; });
            if (found) return found;
        }
    }
    return null;
}

function changeCart(dailyMenuId, delta) {
    var menuItem = findMenuItem(dailyMenuId);
    if (!menuItem) return;
    var fi = menuItem.food_items;
    var remaining = menuItem.total_quantity - menuItem.sold_quantity;

    var existing = cart.find(function(c) { return c.daily_menu_id === dailyMenuId; });
    if (existing) {
        existing.quantity += delta;
        if (existing.quantity <= 0) {
            cart = cart.filter(function(c) { return c.daily_menu_id !== dailyMenuId; });
        } else if (existing.quantity > remaining) {
            existing.quantity = remaining;
        }
    } else if (delta > 0) {
        cart.push({ daily_menu_id: dailyMenuId, name: fi.name, quantity: 1,
            base_price: Number(fi.base_price), discount_price: Number(fi.discount_price) });
    }

    var qtyEl = document.getElementById('qty-' + dailyMenuId);
    var inCart = cart.find(function(c) { return c.daily_menu_id === dailyMenuId; });
    if (qtyEl) qtyEl.textContent = inCart ? inCart.quantity : 0;
    updateCartBar();
}

function cartItemToOrderLines(cartEntry) {
    var menuItem = findMenuItem(cartEntry.daily_menu_id);
    var discountQty = menuItem ? menuItem.discounted_quantity : 0;
    var lines = [];
    var discounted = Math.min(cartEntry.quantity, discountQty);
    var full = cartEntry.quantity - discounted;
    if (discounted > 0) {
        lines.push({ daily_menu_id: cartEntry.daily_menu_id, quantity: discounted,
            unit_price: cartEntry.discount_price, is_discounted: true });
    }
    if (full > 0) {
        lines.push({ daily_menu_id: cartEntry.daily_menu_id, quantity: full,
            unit_price: cartEntry.base_price, is_discounted: false });
    }
    return lines;
}

function cartTotalPrice() {
    return cart.reduce(function(s, c) {
        var menuItem = findMenuItem(c.daily_menu_id);
        var discountQty = menuItem ? menuItem.discounted_quantity : 0;
        var discounted = Math.min(c.quantity, discountQty);
        var full = c.quantity - discounted;
        return s + discounted * c.discount_price + full * c.base_price;
    }, 0);
}

function updateCartBar() {
    var bar = document.getElementById('cartBar');
    var totalItems = cart.reduce(function(s, c) { return s + c.quantity; }, 0);
    var totalPrice = cartTotalPrice();
    if (totalItems > 0) {
        bar.style.display = 'flex';
        document.getElementById('cartInfo').textContent = totalItems + ' vare' + (totalItems !== 1 ? 'r' : '');
        document.getElementById('cartTotal').textContent = totalPrice.toFixed(2) + ' DKK';
    } else { bar.style.display = 'none'; }
}

// PLACE ORDER
async function placeOrder() {
    if (cart.length === 0) return;
    // Determine if reservation from whichever menu data is loaded
    var isReservation = (reserveMenuData && reserveMenuData.erReservation) || false;
    if (buyMenuData && !buyMenuData.erReservation) isReservation = false;
    // If only reserveMenuData is loaded (user is on reserve tab), it's a reservation
    if (!buyMenuData && reserveMenuData) isReservation = true;
    var items = cart.flatMap(function(c) { return cartItemToOrderLines(c); });
    var res = await fetchJSON('/api/ordre', 'POST', { userId: currentUser.id, items: items, isReservation: isReservation });
    if (res.error) { alert('Fejl: ' + res.error); return; }
    var totalPrice = cartTotalPrice();
    showReceiptModal(res.ordre.receipt_code, totalPrice, isReservation);
    cart = [];
    updateCartBar();
    // Reload whichever section is active
    var activeSection = document.querySelector('.section.active');
    if (activeSection) {
        if (activeSection.id === 'buySection') loadBuySection();
        else if (activeSection.id === 'reserveSection') loadReserveSection();
    }
}

function showReceiptModal(code, total, isRes) {
    var overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    var title = isRes ? 'Reservation bekræftet!' : 'Betaling gennemført!';
    overlay.innerHTML =
        '<div class="modal">' +
        '<h2 style="color:var(--green-dark);">' + title + '</h2>' +
        '<p style="color:var(--text-muted); margin-top:10px;">Vis denne kode i kantinen:</p>' +
        '<div class="receipt-code">' + code + '</div>' +
        '<p style="color:var(--text-muted);">Total: ' + total.toFixed(2) + ' DKK</p>' +
        '<button id="closeModalBtn">OK</button></div>';
    document.body.appendChild(overlay);
    document.getElementById('closeModalBtn').addEventListener('click', function() { overlay.remove(); });
}

// ════════════════════════════════════════════════════════
// MINE ORDRER
// ════════════════════════════════════════════════════════

async function loadMineOrdrer() {
    var ordrer = await fetchJSON('/api/ordrer/' + currentUser.id);
    var list = document.getElementById('ordrerList');
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);">Ingen ordrer endnu.</p>'; return; }

    var statusLabels = { reserved: 'Reserveret', paid: 'Betalt', picked_up: 'Afhentet', cancelled: 'Annulleret' };
    ordrer.forEach(function(o) {
        var card = document.createElement('div');
        card.classList.add('receipt-card');
        var dato = new Date(o.placed_at).toLocaleString('da-DK');
        var itemsHTML = '';
        if (o.order_items) {
            o.order_items.forEach(function(oi) {
                var fn = (oi.daily_menu && oi.daily_menu.food_items) ? oi.daily_menu.food_items.name : 'Ukendt';
                itemsHTML += '<div>' + oi.quantity + 'x ' + fn + ' - ' + Number(oi.unit_price).toFixed(2) + ' DKK' + (oi.is_discounted ? ' (rabat)' : '') + '</div>';
            });
        }
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="color:var(--text-muted);font-size:0.85em;">' + dato + '</span>' +
            '<span class="status-badge status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></div>' +
            '<div class="receipt-code">' + o.receipt_code + '</div>' +
            '<div style="margin:10px 0;color:var(--text);">' + itemsHTML + '</div>' +
            '<div style="font-weight:bold;color:var(--green-dark);">Total: ' + Number(o.total_price).toFixed(2) + ' DKK</div>';
        list.appendChild(card);
    });
}

// ════════════════════════════════════════════════════════
// ADMIN: MANAGE MENU
// ════════════════════════════════════════════════════════

var allFoodItems = [];
var adminSelectedCategory = null;

async function loadAdminMenu() {
    var dateInput = document.getElementById('adminMenuDate');
    if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    allFoodItems = await fetchJSON('/api/fooditems');

    var categories = [];
    allFoodItems.forEach(function(fi) {
        var cn = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : 'Andet';
        var cid = fi.category_id || 0;
        if (!categories.find(function(c) { return c.id === cid; })) {
            categories.push({ id: cid, name: cn });
        }
    });

    var tabsContainer = document.getElementById('adminCategoryTabs');
    tabsContainer.innerHTML = '';

    var allTab = document.createElement('button');
    allTab.textContent = 'Alle';
    allTab.classList.add('category-tab');
    if (!adminSelectedCategory) allTab.classList.add('active');
    allTab.addEventListener('click', function() { adminSelectedCategory = null; filterFoodSelect(); highlightTab(tabsContainer, this); });
    tabsContainer.appendChild(allTab);

    categories.forEach(function(cat) {
        var tab = document.createElement('button');
        tab.textContent = cat.name;
        tab.classList.add('category-tab');
        if (adminSelectedCategory === cat.id) tab.classList.add('active');
        tab.addEventListener('click', function() { adminSelectedCategory = cat.id; filterFoodSelect(); highlightTab(tabsContainer, this); });
        tabsContainer.appendChild(tab);
    });

    filterFoodSelect();
    await loadAdminMenuForDate();
    dateInput.onchange = loadAdminMenuForDate;
}

function highlightTab(container, activeBtn) {
    container.querySelectorAll('.category-tab').forEach(function(b) { b.classList.remove('active'); });
    activeBtn.classList.add('active');
}

function filterFoodSelect() {
    var select = document.getElementById('adminFoodSelect');
    select.innerHTML = '';
    var filtered = allFoodItems.filter(function(fi) {
        if (adminSelectedCategory === null) return true;
        return (fi.category_id || 0) === adminSelectedCategory;
    });
    filtered.forEach(function(fi) {
        var opt = document.createElement('option');
        opt.value = fi.id;
        var cn = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : '';
        opt.textContent = fi.name + ' (' + cn + ') - ' + Number(fi.base_price).toFixed(2) + ' DKK';
        select.appendChild(opt);
    });
}

async function loadAdminMenuForDate() {
    var dato = document.getElementById('adminMenuDate').value;
    var menu = await fetchJSON('/api/menu/' + dato);
    var grid = document.getElementById('adminMenuGrid');
    grid.innerHTML = '';
    if (!menu || menu.length === 0) { grid.innerHTML = '<p style="color:var(--text-muted);">Ingen items på menuen.</p>'; return; }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div><h3>' + fi.name + '</h3>' +
            '<div style="color:var(--text-muted);">Total: ' + item.total_quantity + ' | Solgt: ' + item.sold_quantity + ' | Tilbage: ' + rem + ' | Rabat: ' + item.discounted_quantity + '</div></div>' +
            '<button class="fjern-btn" data-mid="' + item.id + '" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">Fjern</button>' +
            '</div>';
        grid.appendChild(card);
    });
}

async function adminFjernMenuItem(dailyMenuId) {
    if (!confirm('Fjern denne ret fra menuen?')) return;
    await fetchJSON('/api/menu/' + dailyMenuId, 'DELETE');
    await loadAdminMenuForDate();
}

async function adminTilfoejMenu() {
    var foodItemId = document.getElementById('adminFoodSelect').value;
    var menuDate = document.getElementById('adminMenuDate').value;
    var totalQuantity = parseInt(document.getElementById('adminQuantity').value);
    if (!foodItemId || !menuDate || !totalQuantity) { alert('Udfyld alle felter'); return; }
    await fetchJSON('/api/menu/tilfoej', 'POST', { foodItemId: foodItemId, menuDate: menuDate, totalQuantity: totalQuantity });
    await loadAdminMenuForDate();
}

// ════════════════════════════════════════════════════════
// ADMIN: ALL ORDERS
// ════════════════════════════════════════════════════════

async function loadAdminOrdrer() {
    var dato = new Date().toISOString().split('T')[0];
    var ordrer = await fetchJSON('/api/ordrer/alle/' + dato);
    var list = document.getElementById('adminOrdrerList');
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);">Ingen ordrer i dag.</p>'; return; }

    var statusLabels = { reserved: 'Reserveret', paid: 'Betalt', picked_up: 'Afhentet', cancelled: 'Annulleret' };
    ordrer.forEach(function(o) {
        var card = document.createElement('div');
        card.classList.add('admin-order-card');
        if (o.is_reservation) card.classList.add('reservation');
        var d = new Date(o.placed_at).toLocaleString('da-DK');
        var sn = (o.profiles && o.profiles.full_name) ? o.profiles.full_name : ((o.profiles && o.profiles.email) ? o.profiles.email : 'Ukendt');
        var ih = '';
        if (o.order_items) {
            o.order_items.forEach(function(oi) {
                var fn = (oi.daily_menu && oi.daily_menu.food_items) ? oi.daily_menu.food_items.name : '?';
                ih += oi.quantity + 'x ' + fn + (oi.is_discounted ? ' (rabat)' : '') + ', ';
            });
        }
        var actionBtn = '';
        if (o.status !== 'picked_up' && o.status !== 'cancelled') {
            actionBtn = '<button class="admin-btn mark-btn" data-oid="' + o.id + '" style="margin-top:8px;">Marker som afhentet</button>';
        }
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
            '<strong>' + o.receipt_code + '</strong>' +
            '<span class="status-badge status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></div>' +
            '<div style="color:var(--text-muted);margin:6px 0;">' + sn + ' - ' + d + '</div>' +
            '<div style="color:var(--text);">' + ih + '</div>' +
            '<div style="color:var(--green-dark);font-weight:bold;">' + Number(o.total_price).toFixed(2) + ' DKK' +
            (o.is_reservation ? ' <span style="color:var(--warning);">(Reservation)</span>' : '') + '</div>' + actionBtn;
        list.appendChild(card);
    });
}

async function markPickedUp(ordreId) {
    await fetchJSON('/api/ordre/status', 'POST', { ordreId: ordreId, nyStatus: 'picked_up' });
    loadAdminOrdrer();
}

// ════════════════════════════════════════════════════════
// ADMIN: DISCOUNTS
// ════════════════════════════════════════════════════════

async function loadDiscountView() {
    var grid = document.getElementById('discountGrid');
    grid.innerHTML = '';

    // Only allow discounts during canteen open hours
    var res = await fetchJSON('/api/menu');
    if (res.erReservation) {
        grid.innerHTML = '<p style="color:var(--text-muted);">Rabatter kan kun sættes i kantinens åbningstid (07:00-13:45).</p>';
        return;
    }

    var menu = res.menu || [];
    if (menu.length === 0) { grid.innerHTML = '<p style="color:var(--text-muted);">Ingen menu i dag.</p>'; return; }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<h3>' + fi.name + '</h3>' +
            '<div style="color:var(--text-muted);margin-bottom:8px;">Tilbage: ' + rem + ' | Rabatpris: ' + Number(fi.discount_price).toFixed(2) + ' DKK | Rabat på: ' + item.discounted_quantity + ' stk</div>' +
            '<label style="color:var(--text);">Antal til rabat: </label>' +
            '<input type="number" id="disc-' + item.id + '" min="0" max="' + rem + '" value="' + item.discounted_quantity + '">' +
            '<button class="disc-btn" data-did="' + item.id + '">Opdater</button>';
        grid.appendChild(card);
    });
}

async function setDiscount(dailyMenuId) {
    var input = document.getElementById('disc-' + dailyMenuId);
    var max = parseInt(input.max);
    var qty = Math.min(Math.max(0, parseInt(input.value) || 0), max);
    if (qty !== parseInt(input.value)) {
        alert('Antal til rabat kan ikke overstige det resterende lager (' + max + ' stk).');
        input.value = qty;
        return;
    }
    await fetchJSON('/api/menu/discount', 'POST', { dailyMenuId: dailyMenuId, discountedQuantity: qty });
    loadDiscountView();
}

// ════════════════════════════════════════════════════════
// STATISTICS PANEL (D3.js line charts)
// ════════════════════════════════════════════════════════

var statsRawData = [];      // array of per-item-per-date objects from API
var statsDailyOrders = {};  // date -> order count
var statsSelectedItems = {};
var statsColorMap = {};
var statsAllItems = [];
var statsPeriodDays = 7;
var statsCustomDate = null;  // if user picks a specific date

// Soft, distinguishable line colors for white background
var STATS_COLORS = [
    '#2ecc71', '#3498db', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#2980b9', '#c0392b', '#16a085',
    '#8e44ad', '#d35400', '#27ae60', '#2c3e50', '#f1c40f',
    '#00cec9', '#6c5ce7', '#fd79a8', '#00b894', '#e17055'
];

// Metric labels for display
var METRIC_LABELS = {
    total_sold: 'Antal solgt',
    total_revenue: 'Omsætning (DKK)',
    discounted_sold: 'Rabat-salg (antal)',
    discounted_revenue: 'Rabat-omsætning (DKK)',
    full_price_sold: 'Fuld pris (antal)',
    reservations: 'Reservationer',
    direct_purchases: 'Direkte køb',
    picked_up: 'Afhentet',
    cancelled: 'Annulleret'
};

function initStatsPanel() {
    var datePicker = document.getElementById('statsDatePicker');
    if (!datePicker.value) datePicker.value = new Date().toISOString().split('T')[0];
    loadStats();
}

function setStatsPeriod(days, btn) {
    statsPeriodDays = days;
    statsCustomDate = null;
    document.querySelectorAll('.stats-period-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    loadStats();
}

function onStatsDatePick() {
    var val = document.getElementById('statsDatePicker').value;
    if (!val) return;
    statsCustomDate = val;
    // highlight: deactivate all period buttons
    document.querySelectorAll('.stats-period-btn').forEach(function(b) { b.classList.remove('active'); });
    statsPeriodDays = 1;
    loadStats();
}

function statsDateRange() {
    if (statsCustomDate) {
        return { from: statsCustomDate, to: statsCustomDate };
    }
    var to = new Date();
    var from = new Date();
    from.setDate(from.getDate() - (statsPeriodDays - 1));
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0]
    };
}

async function loadStats() {
    var range = statsDateRange();
    var res = await fetchJSON('/api/stats/sales?from=' + range.from + '&to=' + range.to);
    if (!res || res.error) {
        statsRawData = [];
        statsDailyOrders = {};
    } else {
        statsRawData = res.items || [];
        statsDailyOrders = res.dailyOrders || {};
    }
    buildItemSelector();
    renderChart();
    renderSummary();
}

function buildItemSelector() {
    var container = document.getElementById('statsItemList');
    var noItems = document.getElementById('statsNoItems');
    container.innerHTML = '';

    var itemMap = {};
    statsRawData.forEach(function(r) {
        if (!itemMap[r.food_item_id]) {
            itemMap[r.food_item_id] = { id: r.food_item_id, name: r.item_name, category: r.category_name };
        }
    });
    statsAllItems = Object.values(itemMap);
    statsAllItems.sort(function(a, b) {
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });

    if (statsAllItems.length === 0) {
        noItems.style.display = 'block';
        return;
    }
    noItems.style.display = 'none';

    // assign colors
    statsColorMap = {};
    statsAllItems.forEach(function(item, i) {
        statsColorMap[item.id] = STATS_COLORS[i % STATS_COLORS.length];
    });

    // auto-select new items
    statsAllItems.forEach(function(item) {
        if (statsSelectedItems[item.id] === undefined) {
            statsSelectedItems[item.id] = true;
        }
    });

    statsAllItems.forEach(function(item) {
        var chip = document.createElement('div');
        chip.classList.add('stats-item-chip');
        chip.dataset.itemId = item.id;
        if (statsSelectedItems[item.id]) chip.classList.add('selected');
        chip.innerHTML = '<span class="chip-dot" style="background:' + statsColorMap[item.id] + '"></span>' +
            '<span>' + item.name + '</span>';
        chip.addEventListener('click', function() {
            statsSelectedItems[item.id] = !statsSelectedItems[item.id];
            chip.classList.toggle('selected', statsSelectedItems[item.id]);
            renderChart();
            renderSummary();
        });
        container.appendChild(chip);
    });
}

function selectAllItems() {
    statsAllItems.forEach(function(item) { statsSelectedItems[item.id] = true; });
    document.querySelectorAll('.stats-item-chip').forEach(function(c) { c.classList.add('selected'); });
    renderChart();
    renderSummary();
}

function resetItemSelection() {
    statsAllItems.forEach(function(item) { statsSelectedItems[item.id] = false; });
    document.querySelectorAll('.stats-item-chip').forEach(function(c) { c.classList.remove('selected'); });
    renderChart();
    renderSummary();
}

function getSelectedStatsData() {
    return statsRawData.filter(function(r) { return statsSelectedItems[r.food_item_id]; });
}

// ── CHART RENDERING ────────────────────────────────────

// Generate every date between from and to (inclusive)
function generateDateRange(from, to) {
    var dates = [];
    var current = new Date(from + 'T00:00:00');
    var end = new Date(to + 'T00:00:00');
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function renderChart() {
    var chartDiv = document.getElementById('statsChart');
    var legendDiv = document.getElementById('statsLegend');
    chartDiv.innerHTML = '';
    legendDiv.innerHTML = '';
    d3.selectAll('.stats-tooltip').remove();

    var metric = document.getElementById('statsMetric').value;
    var filtered = getSelectedStatsData();

    if (filtered.length === 0) {
        chartDiv.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:80px 20px;">' +
            (statsRawData.length === 0 ? 'Ingen salgsdata i denne periode.' : 'Vælg mindst et item herover.') + '</p>';
        return;
    }

    // collect dates from actual data + items
    var dateSet = {};
    var itemIdSet = {};
    var itemNames = {};
    filtered.forEach(function(r) {
        dateSet[r.menu_date] = true;
        if (!itemIdSet[r.food_item_id]) {
            itemIdSet[r.food_item_id] = true;
            itemNames[r.food_item_id] = r.item_name;
        }
    });
    var dataDates = Object.keys(dateSet).sort();
    var itemIds = Object.keys(itemIdSet);

    // value lookup (missing dates default to 0)
    var lookup = {};
    filtered.forEach(function(r) {
        var key = r.menu_date + '|' + r.food_item_id;
        lookup[key] = Number(r[metric]) || 0;
    });

    // Decide: single day -> bar chart, multi-day -> line chart
    // For single day, use data dates directly (the old working logic)
    var range = statsDateRange();
    var isSingleDay = (range.from === range.to);

    // For line chart: generate full date range so gaps show as 0
    var chartDates = isSingleDay ? dataDates : generateDateRange(range.from, range.to);

    // chart sizing
    var containerWidth = chartDiv.clientWidth || 700;
    var margin = { top: 24, right: 30, bottom: 70, left: 65 };
    var width = Math.max(containerWidth - margin.left - margin.right, 200);
    var height = 360;

    var svg = d3.select('#statsChart')
        .append('svg')
        .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + (height + margin.top + margin.bottom))
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var tooltip = d3.select('body').append('div').attr('class', 'stats-tooltip').style('opacity', 0);
    var yLabel = METRIC_LABELS[metric] || metric;
    var isRevenue = metric.indexOf('revenue') !== -1;

    // max value (use chartDates so bar chart only checks data dates)
    var maxVal = 0;
    chartDates.forEach(function(d) {
        itemIds.forEach(function(id) {
            var v = lookup[d + '|' + id] || 0;
            if (v > maxVal) maxVal = v;
        });
    });

    if (isSingleDay && dataDates.length >= 1) {
        drawBarChart(svg, tooltip, dataDates[0], itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue);
    } else if (chartDates.length >= 2) {
        drawMultiLineChart(svg, tooltip, chartDates, itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue);
    }

    // legend
    itemIds.forEach(function(id) {
        var el = document.createElement('div');
        el.classList.add('stats-legend-item');
        el.innerHTML = '<span class="stats-legend-dot" style="background:' + statsColorMap[id] + '"></span>' +
            '<span>' + itemNames[id] + '</span>';
        legendDiv.appendChild(el);
    });
}

// ── BAR CHART (single day / histogram) ─────────────────

function drawBarChart(svg, tooltip, date, itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue) {
    // Build data array: one bar per item
    var barData = itemIds.map(function(id) {
        return { id: id, name: itemNames[id], val: lookup[date + '|' + id] || 0 };
    }).sort(function(a, b) { return b.val - a.val; }); // sort descending

    var x = d3.scaleBand()
        .domain(barData.map(function(d) { return d.id; }))
        .range([0, width])
        .padding(0.25);

    var y = d3.scaleLinear().domain([0, maxVal * 1.15 || 1]).nice().range([height, 0]);

    // x axis - item names
    var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).tickFormat(function(id) { return itemNames[id]; }));
    xAxisG.selectAll('text')
        .attr('transform', 'rotate(-40)').style('text-anchor', 'end')
        .style('fill', '#7f8c8d').style('font-size', '10px');
    xAxisG.selectAll('line,path').style('stroke', '#dce6f0');

    // y axis
    var yAxisG = svg.append('g').call(d3.axisLeft(y).ticks(6));
    yAxisG.selectAll('text').style('fill', '#7f8c8d').style('font-size', '11px');
    yAxisG.selectAll('line,path').style('stroke', '#dce6f0');

    // y label
    svg.append('text').attr('x', -height / 2).attr('y', -50).attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle').style('fill', '#7f8c8d').style('font-size', '11px').text(yLabel);

    // grid
    var gridG = svg.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''));
    gridG.selectAll('line').style('stroke', '#e8eff7').style('stroke-dasharray', '3,3');
    gridG.select('.domain').remove();

    // title showing the date
    svg.append('text')
        .attr('x', width / 2).attr('y', -6)
        .attr('text-anchor', 'middle')
        .style('fill', '#2c3e50').style('font-size', '13px').style('font-weight', '600')
        .text(date);

    // bars
    svg.selectAll('.bar').data(barData).enter()
        .append('rect')
        .attr('x', function(d) { return x(d.id); })
        .attr('y', function(d) { return y(d.val); })
        .attr('width', x.bandwidth())
        .attr('height', function(d) { return height - y(d.val); })
        .attr('fill', function(d) { return statsColorMap[d.id]; })
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(80).style('opacity', 1);
            tooltip.html(tooltipHtml(d.name, date, d.val, isRevenue))
                .style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
        })
        .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 1);
            tooltip.transition().duration(150).style('opacity', 0);
        });

    // value labels on top of bars
    svg.selectAll('.bar-label').data(barData).enter()
        .append('text')
        .attr('x', function(d) { return x(d.id) + x.bandwidth() / 2; })
        .attr('y', function(d) { return y(d.val) - 6; })
        .attr('text-anchor', 'middle')
        .style('fill', '#2c3e50').style('font-size', '11px').style('font-weight', '600')
        .text(function(d) { return d.val > 0 ? (isRevenue ? d.val.toFixed(0) : d.val) : ''; });
}

// ── LINE CHART (multi-day period) ──────────────────────

function drawMultiLineChart(svg, tooltip, dates, itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue) {
    var parseDate = d3.timeParse('%Y-%m-%d');
    var formatDate = d3.timeFormat('%d/%m');
    var timeDates = dates.map(function(d) { return parseDate(d); });

    var x = d3.scaleTime()
        .domain(d3.extent(timeDates))
        .range([0, width]);

    var y = d3.scaleLinear().domain([0, maxVal * 1.15 || 1]).nice().range([height, 0]);

    // x axis
    var tickCount = Math.min(dates.length, Math.max(4, Math.floor(width / 80)));
    var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).ticks(tickCount).tickFormat(formatDate));
    xAxisG.selectAll('text')
        .attr('transform', 'rotate(-35)').style('text-anchor', 'end')
        .style('fill', '#7f8c8d').style('font-size', '11px');
    xAxisG.selectAll('line,path').style('stroke', '#dce6f0');

    // y axis
    var yAxisG = svg.append('g').call(d3.axisLeft(y).ticks(6));
    yAxisG.selectAll('text').style('fill', '#7f8c8d').style('font-size', '11px');
    yAxisG.selectAll('line,path').style('stroke', '#dce6f0');

    // y label
    svg.append('text').attr('x', -height / 2).attr('y', -50).attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle').style('fill', '#7f8c8d').style('font-size', '11px').text(yLabel);

    // grid
    var gridG = svg.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''));
    gridG.selectAll('line').style('stroke', '#e8eff7').style('stroke-dasharray', '3,3');
    gridG.select('.domain').remove();

    // date->time lookup
    var dateToTime = {};
    dates.forEach(function(d, i) { dateToTime[d] = timeDates[i]; });

    var line = d3.line()
        .x(function(d) { return x(dateToTime[d.date]); })
        .y(function(d) { return y(d.val); })
        .curve(d3.curveMonotoneX);

    var area = d3.area()
        .x(function(d) { return x(dateToTime[d.date]); })
        .y0(height)
        .y1(function(d) { return y(d.val); })
        .curve(d3.curveMonotoneX);

    // ── 1. Build per-item point arrays ──
    var itemPoints = {};
    itemIds.forEach(function(id) {
        itemPoints[id] = dates.map(function(d) { return { date: d, val: lookup[d + '|' + id] || 0 }; });
    });

    // ── 2. Build overlap map: date -> { valKey -> [itemIds] } ──
    var overlapByDate = {};
    dates.forEach(function(d) {
        var byVal = {};
        itemIds.forEach(function(id) {
            var v = lookup[d + '|' + id] || 0;
            var vk = String(v);
            if (!byVal[vk]) byVal[vk] = [];
            byVal[vk].push(id);
        });
        overlapByDate[d] = byVal;
    });

    // ── 3. Detect overlapping line segments between consecutive dates ──
    // A segment (dateA -> dateB) overlaps for a pair of items if they share
    // the same value on BOTH endpoints.
    var overlapSegments = []; // { dateA, dateB, ids: [...] }
    for (var di = 0; di < dates.length - 1; di++) {
        var dA = dates[di], dB = dates[di + 1];
        // group item pairs that match on both dates
        var segMap = {}; // "valA|valB" -> [ids]
        itemIds.forEach(function(id) {
            var vA = lookup[dA + '|' + id] || 0;
            var vB = lookup[dB + '|' + id] || 0;
            var segKey = vA + '|' + vB;
            if (!segMap[segKey]) segMap[segKey] = [];
            segMap[segKey].push(id);
        });
        for (var sk in segMap) {
            if (segMap[sk].length > 1) {
                overlapSegments.push({ dateA: dA, dateB: dB, ids: segMap[sk] });
            }
        }
    }

    // ── 4. Draw area fills and lines per item ──
    var defs = svg.append('defs');
    var gradientCounter = 0;

    itemIds.forEach(function(id) {
        var points = itemPoints[id];
        var color = statsColorMap[id];

        // area fill
        svg.append('path').datum(points)
            .attr('fill', color).attr('opacity', 0.05).attr('d', area);

        // line
        svg.append('path').datum(points)
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5)
            .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
            .attr('d', line);
    });

    // ── 5. Draw striped overlay segments where lines overlap ──
    overlapSegments.forEach(function(seg) {
        var xA = x(dateToTime[seg.dateA]);
        var yA = y(lookup[seg.dateA + '|' + seg.ids[0]] || 0);
        var xB = x(dateToTime[seg.dateB]);
        var yB = y(lookup[seg.dateB + '|' + seg.ids[0]] || 0);
        var colors = seg.ids.map(function(id) { return statsColorMap[id]; });

        // Create a repeating gradient that stripes the colors
        gradientCounter++;
        var gradId = 'overlap-grad-' + gradientCounter;
        var segLen = Math.sqrt((xB - xA) * (xB - xA) + (yB - yA) * (yB - yA));
        var stripeWidth = 8; // px per color band
        var totalPattern = stripeWidth * colors.length;

        var grad = defs.append('linearGradient')
            .attr('id', gradId)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', xA).attr('y1', yA)
            .attr('x2', xB).attr('y2', yB)
            .attr('spreadMethod', 'repeat');

        // Make the gradient tile by scaling stops to one stripe cycle
        colors.forEach(function(c, i) {
            var startPct = (i / colors.length) * 100;
            var endPct = ((i + 1) / colors.length) * 100;
            grad.append('stop').attr('offset', startPct + '%').attr('stop-color', c);
            grad.append('stop').attr('offset', endPct + '%').attr('stop-color', c);
        });

        // Scale the gradient to repeat every `totalPattern` pixels along the segment
        if (segLen > 0) {
            var ratio = totalPattern / segLen;
            var mx = xA + (xB - xA) * ratio;
            var my = yA + (yB - yA) * ratio;
            grad.attr('x2', mx).attr('y2', my);
        }

        // Draw the overlay segment on top
        svg.append('line')
            .attr('x1', xA).attr('y1', yA)
            .attr('x2', xB).attr('y2', yB)
            .attr('stroke', 'url(#' + gradId + ')')
            .attr('stroke-width', 3.5)
            .attr('stroke-linecap', 'round');
    });

    // ── 6. Group data points by (date, value) for dots and tooltips ──
    var showDots = dates.length <= 60;
    var dotGroups = []; // { date, val, ids: [...] }

    dates.forEach(function(d) {
        var byVal = overlapByDate[d];
        for (var vk in byVal) {
            var ids = byVal[vk];
            var val = parseFloat(vk);
            dotGroups.push({ date: d, val: val, ids: ids });
        }
    });

    // Draw dots: single-color for unique items, pie-split for overlaps
    dotGroups.forEach(function(g) {
        var cx = x(dateToTime[g.date]);
        var cy = y(g.val);
        var colors = g.ids.map(function(id) { return statsColorMap[id]; });

        if (g.ids.length === 1) {
            // Single item: normal dot
            svg.append('circle')
                .attr('cx', cx).attr('cy', cy)
                .attr('r', showDots ? 4.5 : 0)
                .attr('fill', colors[0])
                .attr('stroke', '#fff').attr('stroke-width', 2);
        } else {
            // Multiple items at same value: draw pie-split dot
            var r = showDots ? 7 : 0;
            if (r > 0) {
                drawPieDot(svg, cx, cy, r, colors);
            }
        }
    });

    // ── 7. Invisible hover targets per group (shows all overlapping items) ──
    dotGroups.forEach(function(g) {
        var cx = x(dateToTime[g.date]);
        var cy = y(g.val);
        var names = g.ids.map(function(id) { return itemNames[id]; });
        var colors = g.ids.map(function(id) { return statsColorMap[id]; });

        svg.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 14)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('mouseover', function(event) {
                tooltip.transition().duration(80).style('opacity', 1);
                tooltip.html(tooltipHtmlMulti(names, colors, g.date, g.val, isRevenue))
                    .style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
            })
            .on('mousemove', function(event) {
                tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition().duration(150).style('opacity', 0);
            });
    });
}

// Draw a pie-split dot with colored segments
function drawPieDot(svg, cx, cy, radius, colors) {
    var n = colors.length;
    var arc = d3.arc().innerRadius(0).outerRadius(radius);
    var angleStep = (2 * Math.PI) / n;
    for (var i = 0; i < n; i++) {
        svg.append('path')
            .attr('d', arc({ startAngle: i * angleStep, endAngle: (i + 1) * angleStep }))
            .attr('transform', 'translate(' + cx + ',' + cy + ')')
            .attr('fill', colors[i])
            .attr('stroke', '#fff').attr('stroke-width', 1.5);
    }
}

// Tooltip showing multiple items at the same point
function tooltipHtmlMulti(names, colors, date, val, isRevenue) {
    var valStr = isRevenue ? val.toFixed(2) + ' DKK' : val + ' stk';
    var html = '<span style="color:#7f8c8d;">' + date + '</span> — ' + valStr + '<br>';
    names.forEach(function(name, i) {
        html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
            colors[i] + ';margin-right:6px;vertical-align:middle;"></span>' +
            '<strong>' + name + '</strong>';
        if (i < names.length - 1) html += '<br>';
    });
    return html;
}

function tooltipHtml(name, date, val, isRevenue) {
    return '<strong>' + name + '</strong><br>' +
        '<span style="color:#7f8c8d;">' + date + '</span><br>' +
        (isRevenue ? val.toFixed(2) + ' DKK' : val + ' stk');
}

// ── SUMMARY ────────────────────────────────────────────

function renderSummary() {
    var container = document.getElementById('statsSummary');
    container.innerHTML = '';
    var filtered = getSelectedStatsData();
    if (filtered.length === 0) return;

    var totalSold = 0, totalRevenue = 0, totalReservations = 0, totalDirectPurchases = 0;
    var totalPickedUp = 0, totalCancelled = 0, totalDiscountedSold = 0, totalDiscountedRevenue = 0;
    var uniqueItems = {}, uniqueDays = {};

    filtered.forEach(function(r) {
        totalSold += Number(r.total_sold);
        totalRevenue += Number(r.total_revenue);
        totalReservations += Number(r.reservations);
        totalDirectPurchases += Number(r.direct_purchases);
        totalPickedUp += Number(r.picked_up);
        totalCancelled += Number(r.cancelled);
        totalDiscountedSold += Number(r.discounted_sold);
        totalDiscountedRevenue += Number(r.discounted_revenue);
        uniqueItems[r.food_item_id] = true;
        uniqueDays[r.menu_date] = true;
    });

    var dayCount = Object.keys(uniqueDays).length || 1;

    // count total unique orders
    var totalOrders = 0;
    Object.keys(uniqueDays).forEach(function(d) {
        totalOrders += statsDailyOrders[d] || 0;
    });

    var cards = [
        { label: 'Antal solgt', value: totalSold + ' stk' },
        { label: 'Omsætning', value: totalRevenue.toFixed(2) + ' DKK', blue: true },
        { label: 'Gns. pr. dag', value: (totalRevenue / dayCount).toFixed(2) + ' DKK', blue: true },
        { label: 'Ordrer', value: totalOrders || '-' },
        { label: 'Reservationer', value: totalReservations + ' stk' },
        { label: 'Direkte køb', value: totalDirectPurchases + ' stk' },
        { label: 'Afhentet', value: totalPickedUp + ' stk' },
        { label: 'Annulleret', value: totalCancelled + ' stk' },
        { label: 'Rabat-salg', value: totalDiscountedSold + ' stk' },
        { label: 'Rabat-omsætning', value: totalDiscountedRevenue.toFixed(2) + ' DKK', blue: true },
        { label: 'Unikke varer', value: Object.keys(uniqueItems).length },
        { label: 'Dage med salg', value: dayCount }
    ];

    cards.forEach(function(c) {
        var card = document.createElement('div');
        card.classList.add('stats-summary-card');
        card.innerHTML = '<div class="label">' + c.label + '</div><div class="value' + (c.blue ? ' blue' : '') + '">' + c.value + '</div>';
        container.appendChild(card);
    });
}

// ════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════

async function fetchJSON(url, method, body) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try {
        var res = await fetch(url, opts);
        return await res.json();
    } catch (err) {
        console.log('Fetch fejl:', err);
        return { error: 'Netværksfejl' };
    }
}
