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
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';
    if (!email || !password) { errorEl.textContent = 'Udfyld email og adgangskode'; return; }

    if (isSignUp) {
        const fullName = document.getElementById('fullNameInput').value.trim();
        if (!fullName) { errorEl.textContent = 'Udfyld dit navn'; return; }
        const res = await fetchJSON('/api/signup', 'POST', { email, password, fullName });
        if (res.error) { errorEl.textContent = res.error; return; }
        errorEl.style.color = '#4ecca3';
        errorEl.textContent = 'Konto oprettet! Du kan nu logge ind.';
        toggleAuthMode();
    } else {
        const res = await fetchJSON('/api/signin', 'POST', { email, password });
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

// CART CLICK DELEGATION (single listener, set up once on app load)
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('mainContent').addEventListener('click', function(e) {
        if (e.target.classList.contains('cart-btn')) {
            var id = e.target.dataset.id;
            var delta = parseInt(e.target.dataset.delta);
            changeCart(id, delta);
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
    const nameEl = document.getElementById('userNameDisplay');
    const roleEl = document.getElementById('userRoleDisplay');
    nameEl.textContent = currentProfil ? currentProfil.full_name : currentUser.email;
    roleEl.textContent = (currentProfil && currentProfil.role === 'admin') ? '(Admin)' : '(Elev)';

    const nav = document.getElementById('navBar');
    nav.querySelectorAll('.admin-nav').forEach(function(b) { b.remove(); });

    if (currentProfil && currentProfil.role === 'admin') {
        var adminBtns = [
            { text: 'Administrer menu', section: 'adminMenuSection' },
            { text: 'Alle ordrer', section: 'adminOrdrerSection' },
            { text: 'Rabatter', section: 'adminDiscountSection' }
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
    showSection('menuSection');
}

// NAVIGATION
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('nav button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.section === sectionId);
    });
    if (sectionId === 'menuSection') loadMenu();
    if (sectionId === 'ordrerSection') loadMineOrdrer();
    if (sectionId === 'adminMenuSection') loadAdminMenu();
    if (sectionId === 'adminOrdrerSection') loadAdminOrdrer();
    if (sectionId === 'adminDiscountSection') loadDiscountView();
}

// MENU (STUDENT)
async function loadMenu() {
    var res = await fetchJSON('/api/menu');
    menuData = res;
    var grid = document.getElementById('menuGrid');
    grid.innerHTML = '';

    var bar = document.getElementById('statusBar');
    if (res.erReservation) {
        bar.innerHTML = '<span class="dot dot-yellow"></span> Reservationsperiode (13:45 \u2013 07:00) \u2013 du reserverer mad til <strong>' + res.dato + '</strong>';
    } else {
        bar.innerHTML = '<span class="dot dot-green"></span> Kantinen er \u00e5ben (07:00\u201313:45) \u2013 betal og hent din mad!';
    }
    document.getElementById('menuTitle').textContent = res.erReservation ? 'Reservation til ' + res.dato : 'Menu for ' + res.dato;

    if (!res.menu || res.menu.length === 0) {
        grid.innerHTML = '<p style="color:#aaa;">Ingen menu opsat for denne dato.</p>';
        return;
    }

    res.menu.forEach(function(item) {
        var fi = item.food_items;
        var remaining = item.total_quantity - item.sold_quantity;
        if (remaining <= 0) return;

        var discountAvail = item.discounted_quantity > 0;
        var catName = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : '';
        var card = document.createElement('div');
        card.classList.add('menu-card');

        var priceHTML = '';
        if (discountAvail) {
            priceHTML = '<span class="original-price">' + Number(fi.base_price).toFixed(2) + ' DKK</span>' +
                '<span class="price discounted">' + Number(fi.discount_price).toFixed(2) + ' DKK</span>';
        } else {
            priceHTML = '<span class="price">' + Number(fi.base_price).toFixed(2) + ' DKK</span>';
        }

        var inCart = cart.find(function(c) { return c.daily_menu_id === item.id; });
        var qty = inCart ? inCart.quantity : 0;

        card.innerHTML =
            '<div class="category-label">' + catName + '</div>' +
            '<h3>' + fi.name + '</h3>' +
            '<div class="description">' + (fi.description || '') + '</div>' +
            priceHTML +
            (discountAvail ? '<div class="discount-badge">TILBUD - ' + item.discounted_quantity + ' til rabatpris</div>' : '') +
            '<div class="stock">' + remaining + ' tilbage</div>' +
            '<div class="quantity-ctrl">' +
                '<button data-id="' + item.id + '" data-delta="-1" class="cart-btn">-</button>' +
                '<span id="qty-' + item.id + '">' + qty + '</span>' +
                '<button data-id="' + item.id + '" data-delta="1" class="cart-btn">+</button>' +
            '</div>';
        grid.appendChild(card);
    });
}

function changeCart(dailyMenuId, delta) {
    var menuItem = menuData.menu.find(function(m) { return m.id === dailyMenuId; });
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

// Split a cart entry into order line items respecting the discounted_quantity limit
function cartItemToOrderLines(cartEntry) {
    var menuItem = menuData.menu.find(function(m) { return m.id === cartEntry.daily_menu_id; });
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
        var menuItem = menuData.menu.find(function(m) { return m.id === c.daily_menu_id; });
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
    var isReservation = menuData.erReservation;
    var items = cart.flatMap(function(c) { return cartItemToOrderLines(c); });
    var res = await fetchJSON('/api/ordre', 'POST', { userId: currentUser.id, items: items, isReservation: isReservation });
    if (res.error) { alert('Fejl: ' + res.error); return; }
    var totalPrice = cartTotalPrice();
    showReceiptModal(res.ordre.receipt_code, totalPrice, isReservation);
    cart = [];
    updateCartBar();
    loadMenu();
}

function showReceiptModal(code, total, isRes) {
    var overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    var title = isRes ? 'Reservation bekraeftet!' : 'Betaling gennemfoert!';
    overlay.innerHTML =
        '<div class="modal">' +
        '<h2 style="color:#4ecca3;">' + title + '</h2>' +
        '<p style="color:#aaa; margin-top:10px;">Vis denne kode i kantinen:</p>' +
        '<div class="receipt-code">' + code + '</div>' +
        '<p style="color:#aaa;">Total: ' + total.toFixed(2) + ' DKK</p>' +
        '<button id="closeModalBtn">OK</button></div>';
    document.body.appendChild(overlay);
    document.getElementById('closeModalBtn').addEventListener('click', function() { overlay.remove(); });
}

// MINE ORDRER
async function loadMineOrdrer() {
    var ordrer = await fetchJSON('/api/ordrer/' + currentUser.id);
    var list = document.getElementById('ordrerList');
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) { list.innerHTML = '<p style="color:#aaa;">Ingen ordrer endnu.</p>'; return; }

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
            '<span style="color:#aaa;font-size:0.85em;">' + dato + '</span>' +
            '<span class="status-badge status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></div>' +
            '<div class="receipt-code">' + o.receipt_code + '</div>' +
            '<div style="margin:10px 0;color:#ccc;">' + itemsHTML + '</div>' +
            '<div style="font-weight:bold;color:#4ecca3;">Total: ' + Number(o.total_price).toFixed(2) + ' DKK</div>';
        list.appendChild(card);
    });
}

// ADMIN: MANAGE MENU
let allFoodItems = [];
let adminSelectedCategory = null;

async function loadAdminMenu() {
    var dateInput = document.getElementById('adminMenuDate');
    if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    allFoodItems = await fetchJSON('/api/fooditems');

    // build category tabs
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
    if (!menu || menu.length === 0) { grid.innerHTML = '<p style="color:#aaa;">Ingen items paa menuen.</p>'; return; }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div><h3>' + fi.name + '</h3>' +
            '<div style="color:#aaa;">Total: ' + item.total_quantity + ' | Solgt: ' + item.sold_quantity + ' | Tilbage: ' + rem + ' | Rabat: ' + item.discounted_quantity + '</div></div>' +
            '<button class="fjern-btn" data-mid="' + item.id + '" style="background:#e94560;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">Fjern</button>' +
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

// ADMIN: ALL ORDERS
async function loadAdminOrdrer() {
    var dato = new Date().toISOString().split('T')[0];
    var ordrer = await fetchJSON('/api/ordrer/alle/' + dato);
    var list = document.getElementById('adminOrdrerList');
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) { list.innerHTML = '<p style="color:#aaa;">Ingen ordrer i dag.</p>'; return; }

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
            '<div style="color:#aaa;margin:6px 0;">' + sn + ' - ' + d + '</div>' +
            '<div style="color:#ccc;">' + ih + '</div>' +
            '<div style="color:#4ecca3;font-weight:bold;">' + Number(o.total_price).toFixed(2) + ' DKK' +
            (o.is_reservation ? ' <span style="color:#f0a500;">(Reservation)</span>' : '') + '</div>' + actionBtn;
        list.appendChild(card);
    });
}

async function markPickedUp(ordreId) {
    await fetchJSON('/api/ordre/status', 'POST', { ordreId: ordreId, nyStatus: 'picked_up' });
    loadAdminOrdrer();
}

// ADMIN: DISCOUNTS
async function loadDiscountView() {
    var dato = new Date().toISOString().split('T')[0];
    var menu = await fetchJSON('/api/menu/' + dato);
    var grid = document.getElementById('discountGrid');
    grid.innerHTML = '';
    if (!menu || menu.length === 0) { grid.innerHTML = '<p style="color:#aaa;">Ingen menu i dag.</p>'; return; }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<h3>' + fi.name + '</h3>' +
            '<div style="color:#aaa;margin-bottom:8px;">Tilbage: ' + rem + ' | Rabatpris: ' + Number(fi.discount_price).toFixed(2) + ' DKK | Rabat paa: ' + item.discounted_quantity + ' stk</div>' +
            '<label style="color:#ccc;">Antal til rabat: </label>' +
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

// HELPER
async function fetchJSON(url, method, body) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try {
        var res = await fetch(url, opts);
        return await res.json();
    } catch (err) {
        console.log('Fetch fejl:', err);
        return { error: 'Netvaerksfejl' };
    }
}
