// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
let currentUser = null;
let currentProfil = null;
let cart = [];
let isSignUp = false;
let menuData = null;
let lastFocusedBeforeModal = null; // for focus-return after modal closes

// ════════════════════════════════════════════════════════
// DANISH COPYWRITING HELPERS
// ════════════════════════════════════════════════════════
// Map English category names from DB -> Danish UI labels
const CATEGORY_DA = {
    'Main': 'Hovedret',
    'Drink': 'Drikkevare',
    'Snack': 'Snack',
    'Dessert': 'Dessert',
    'Andet': 'Andet'
};
function daCategory(name) {
    if (!name) return 'Andet';
    return CATEGORY_DA[name] || name;
}

// DKK price helper (Danish format with comma)
function formatPrice(amount) {
    var n = Number(amount) || 0;
    return n.toFixed(2).replace('.', ',') + ' DKK';
}

// Friendlier Danish error messages for common server errors
function friendlyError(msg) {
    if (!msg) return 'Noget gik galt. Prøv igen.';
    var m = String(msg).toLowerCase();
    if (m.indexOf('network') !== -1 || m.indexOf('netværk') !== -1) return 'Ingen forbindelse. Tjek dit internet og prøv igen.';
    if (m.indexOf('server fejl') !== -1 || m.indexOf('server error') !== -1) return 'Serveren svarer ikke lige nu. Prøv igen om et øjeblik.';
    if (m.indexOf('unauthor') !== -1) return 'Forkert email eller adgangskode.';
    if (m.indexOf('forbidden') !== -1) return 'Du har ikke rettigheder til denne handling.';
    if (m.indexOf('not found') !== -1) return 'Vi kunne ikke finde det, du leder efter.';
    return msg;
}

// ════════════════════════════════════════════════════════
// TOAST SYSTEM (replaces alert / confirm)
// ════════════════════════════════════════════════════════
function showToast(message, variant, title) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    variant = variant || 'info';
    var icons = { success: '✓', error: '!', info: 'i', warning: '!' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + variant;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    var titleHtml = title ? '<strong>' + title + '</strong>' : '';
    toast.innerHTML =
        '<span class="toast-icon" aria-hidden="true">' + (icons[variant] || 'i') + '</span>' +
        '<div class="toast-body">' + titleHtml + message + '</div>' +
        '<button class="toast-close" aria-label="Luk besked">' +
        '<svg width="16" height="16" aria-hidden="true"><use href="#ic-close"/></svg></button>';
    container.appendChild(toast);

    var closeBtn = toast.querySelector('.toast-close');
    var timer = setTimeout(function() { dismiss(); }, 4000);
    function dismiss() {
        clearTimeout(timer);
        toast.classList.add('leaving');
        setTimeout(function() { toast.remove(); }, 220);
    }
    closeBtn.addEventListener('click', dismiss);
    return toast;
}

// Promise-based confirm (replaces confirm())
function askConfirm(message, confirmLabel, cancelLabel) {
    return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML =
            '<div class="modal" role="document">' +
            '<h2 style="color:var(--text);font-size:1.2em;margin-bottom:12px;">Bekræft</h2>' +
            '<p style="color:var(--text-muted);margin-bottom:20px;">' + message + '</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;">' +
            '<button class="modal-primary" style="background:var(--bg);color:var(--text);border:2px solid var(--border);">' +
            (cancelLabel || 'Annullér') + '</button>' +
            '<button class="modal-primary" style="background:var(--danger);">' +
            (confirmLabel || 'Bekræft') + '</button>' +
            '</div></div>';
        var trigger = document.activeElement;
        document.body.appendChild(overlay);
        var btns = overlay.querySelectorAll('button');
        btns[0].focus();
        function close(val) {
            overlay.remove();
            if (trigger && trigger.focus) trigger.focus();
            resolve(val);
        }
        btns[0].addEventListener('click', function() { close(false); });
        btns[1].addEventListener('click', function() { close(true); });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
        });
    });
}

// ════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════
function toggleAuthMode() {
    isSignUp = !isSignUp;
    document.getElementById('authTitle').textContent = isSignUp ? 'Opret konto' : 'Log ind';
    document.getElementById('authBtn').textContent = isSignUp ? 'Opret konto' : 'Log ind';
    document.getElementById('toggleAuth').textContent = isSignUp
        ? 'Har du allerede en konto? Log ind her'
        : 'Har du ingen konto? Opret en her';
    document.getElementById('signupFields').classList.toggle('hidden', !isSignUp);
    var err = document.getElementById('authError');
    err.textContent = '';
    err.style.color = 'var(--danger)';
}

async function handleAuth() {
    var email = document.getElementById('emailInput').value.trim();
    var password = document.getElementById('passwordInput').value;
    var errorEl = document.getElementById('authError');
    errorEl.style.color = 'var(--danger)';
    errorEl.textContent = '';
    if (!email || !password) { errorEl.textContent = 'Udfyld email og adgangskode'; return; }

    if (isSignUp) {
        var fullName = document.getElementById('fullNameInput').value.trim();
        if (!fullName) { errorEl.textContent = 'Udfyld dit navn'; return; }
        var res = await fetchJSON('/api/signup', 'POST', { email: email, password: password, fullName: fullName });
        if (res.error) { errorEl.textContent = friendlyError(res.error); return; }
        errorEl.style.color = 'var(--green-dark)';
        errorEl.textContent = 'Konto oprettet — du kan nu logge ind.';
        toggleAuthMode();
    } else {
        var res = await fetchJSON('/api/signin', 'POST', { email: email, password: password });
        if (res.error) { errorEl.textContent = friendlyError(res.error); return; }
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
    var btb = document.getElementById('bottomTabBar');
    if (btb) btb.classList.add('hidden');
}

// ════════════════════════════════════════════════════════
// CART CLICK DELEGATION + keyboard activation
// ════════════════════════════════════════════════════════
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

    // Auth toggle-link: allow keyboard activation
    var tog = document.getElementById('toggleAuth');
    if (tog) {
        tog.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAuthMode(); }
        });
    }

    // Enter-to-submit on auth form
    ['emailInput', 'passwordInput', 'fullNameInput'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); handleAuth(); }
        });
    });

    // Onboarding wiring
    initOnboarding();
});

// ════════════════════════════════════════════════════════
// ONBOARDING (3 slides, shown once per browser)
// ════════════════════════════════════════════════════════
var onboardingIndex = 0;
function initOnboarding() {
    var next = document.getElementById('onbNextBtn');
    var back = document.getElementById('onbBackBtn');
    var skip = document.getElementById('onbSkipBtn');
    if (!next) return;
    next.addEventListener('click', function() { onboardingGoto(onboardingIndex + 1); });
    back.addEventListener('click', function() { onboardingGoto(onboardingIndex - 1); });
    skip.addEventListener('click', finishOnboarding);
}
function showOnboardingIfFirstTime() {
    try {
        if (localStorage.getItem('bc_onboarded') === 'true') return;
    } catch (e) { /* localStorage blocked — show anyway */ }
    var overlay = document.getElementById('onboarding');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    onboardingGoto(0);
    // focus next-btn after a tick so screen-reader reads the dialog
    setTimeout(function() {
        var n = document.getElementById('onbNextBtn');
        if (n) n.focus();
    }, 50);
}
function onboardingGoto(i) {
    var slides = document.querySelectorAll('.onboarding-slide');
    var dots = document.querySelectorAll('.onboarding-dots .dot');
    if (i < 0) i = 0;
    if (i >= slides.length) { finishOnboarding(); return; }
    onboardingIndex = i;
    slides.forEach(function(s, idx) { s.classList.toggle('hidden', idx !== i); });
    dots.forEach(function(d, idx) { d.classList.toggle('active', idx === i); });
    var back = document.getElementById('onbBackBtn');
    var next = document.getElementById('onbNextBtn');
    back.classList.toggle('hidden', i === 0);
    next.textContent = (i === slides.length - 1) ? 'Kom i gang' : 'Næste';
}
function finishOnboarding() {
    try { localStorage.setItem('bc_onboarded', 'true'); } catch (e) {}
    var overlay = document.getElementById('onboarding');
    if (overlay) overlay.classList.add('hidden');
}

// ════════════════════════════════════════════════════════
// APP INIT
// ════════════════════════════════════════════════════════
function enterApp() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = currentProfil ? currentProfil.full_name : currentUser.email;
    document.getElementById('userRoleDisplay').textContent = (currentProfil && currentProfil.role === 'admin') ? '(Admin)' : '(Elev)';

    var nav = document.getElementById('navBar');
    nav.querySelectorAll('.admin-nav').forEach(function(b) { b.remove(); });

    if (currentProfil && currentProfil.role === 'admin') {
        var adminBtns = [
            { text: 'Administrér menu', section: 'adminMenuSection' },
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

    // Show bottom tab-bar on mobile viewports (CSS media-query handles display)
    var btb = document.getElementById('bottomTabBar');
    if (btb) btb.classList.remove('hidden');

    showSection('buySection');
    // Trigger onboarding on first login (after app is visible)
    showOnboardingIfFirstTime();
}

// ════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('nav#navBar button, .bottom-tab-bar button').forEach(function(b) {
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
// LOADING SKELETONS
// ════════════════════════════════════════════════════════
function renderSkeletonList(containerId, count) {
    var c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    for (var i = 0; i < (count || 4); i++) {
        var r = document.createElement('div');
        r.className = 'skeleton-row';
        r.innerHTML =
            '<div class="skeleton skeleton-title"></div>' +
            '<div class="skeleton skeleton-price"></div>' +
            '<div class="skeleton skeleton-btn"></div>';
        c.appendChild(r);
    }
}

// ════════════════════════════════════════════════════════
// STUDENT: BUY & RESERVE SECTIONS
// ════════════════════════════════════════════════════════
var buyMenuData = null;
var reserveMenuData = null;
var activeBuyCategory = null;
var activeReserveCategory = null;

async function loadBuySection() {
    var statusBar = document.getElementById('buyStatusBar');
    var closedMsg = document.getElementById('buyClosedMsg');
    var content = document.getElementById('buyContent');
    var title = document.getElementById('buyTitle');

    // show skeleton while fetching
    var skeletonTimer = setTimeout(function() {
        content.classList.remove('hidden');
        closedMsg.classList.add('hidden');
        renderSkeletonList('buyItemList', 4);
    }, 150);

    var res = await fetchJSON('/api/menu');
    clearTimeout(skeletonTimer);

    if (res.erReservation) {
        statusBar.innerHTML = '<span class="dot dot-red"></span> Kantinen er lukket';
        closedMsg.classList.remove('hidden');
        content.classList.add('hidden');
        title.textContent = 'Køb — kantinen er lukket';
    } else {
        buyMenuData = res;
        statusBar.innerHTML = '<span class="dot dot-green"></span> Kantinen er åben (07:00-13:45) — ' + res.dato;
        closedMsg.classList.add('hidden');
        content.classList.remove('hidden');
        title.textContent = 'Køb — menu for ' + res.dato;
        renderMenuPanel('buy', res.menu || [], activeBuyCategory);
    }
}

async function loadReserveSection() {
    var statusBar = document.getElementById('reserveStatusBar');
    var openMsg = document.getElementById('reserveOpenMsg');
    var content = document.getElementById('reserveContent');
    var title = document.getElementById('reserveTitle');

    var skeletonTimer = setTimeout(function() {
        content.classList.remove('hidden');
        openMsg.classList.add('hidden');
        renderSkeletonList('reserveItemList', 4);
    }, 150);

    var res = await fetchJSON('/api/menu');
    clearTimeout(skeletonTimer);

    if (!res.erReservation) {
        statusBar.innerHTML = '<span class="dot dot-green"></span> Kantinen er åben lige nu';
        openMsg.classList.remove('hidden');
        content.classList.add('hidden');
        title.textContent = 'Reservér';
    } else {
        reserveMenuData = res;
        statusBar.innerHTML = '<span class="dot dot-yellow"></span> Reservationsperiode — reservér til <strong>' + res.dato + '</strong>';
        openMsg.classList.add('hidden');
        content.classList.remove('hidden');
        title.textContent = 'Reservér — menu for ' + res.dato;
        renderMenuPanel('reserve', res.menu || [], activeReserveCategory);
    }
}

function getMenuDataForMode(mode) {
    return mode === 'buy' ? buyMenuData : reserveMenuData;
}

// Escape text to prevent HTML injection when rendering dynamic strings
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMenuPanel(mode, menu, activeCategory) {
    var tabsId = mode === 'buy' ? 'buyCategoryTabs' : 'reserveCategoryTabs';
    var listId = mode === 'buy' ? 'buyItemList' : 'reserveItemList';
    var detailId = mode === 'buy' ? 'buyDetailPanel' : 'reserveDetailPanel';

    var tabsContainer = document.getElementById(tabsId);
    var listContainer = document.getElementById(listId);
    var detailPanel = document.getElementById(detailId);

    // Reset detail panel
    detailPanel.innerHTML = '<div class="detail-placeholder">Peg på en ret for at se detaljer</div>';

    // Build category list from menu
    var categories = [];
    var catMap = {};
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rawName = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : 'Andet';
        var cn = daCategory(rawName);
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
    allTab.setAttribute('role', 'tab');
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
        tab.setAttribute('role', 'tab');
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
        listContainer.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-menu"/></svg>' +
            '<h3>Ingen retter i denne kategori</h3>' +
            '<p>Prøv at vælge en anden kategori eller kom tilbage senere.</p>' +
            '</div>';
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
            priceHTML = '<span class="original-price">' + formatPrice(fi.base_price) + '</span>' +
                '<span class="price discounted">' + formatPrice(fi.discount_price) + '</span>';
        } else {
            priceHTML = '<span class="price">' + formatPrice(fi.base_price) + '</span>';
        }

        // Build always-visible meta chips (allergens + halal)
        var chipsHtml = '';
        var allergens = fi.allergens || '';
        if (allergens) {
            allergens.split(',').forEach(function(a) {
                var t = a.trim();
                if (!t) return;
                chipsHtml += '<span class="meta-chip allergen" title="Allergen">' + escapeHtml(t) + '</span>';
            });
        }
        if (fi.is_halal === true) {
            chipsHtml += '<span class="meta-chip halal" title="Halal">✓ Halal</span>';
        } else if (fi.is_halal === false) {
            chipsHtml += '<span class="meta-chip not-halal" title="Ikke halal">Ikke halal</span>';
        }

        row.innerHTML =
            '<div class="item-info">' +
                '<div class="item-name">' + escapeHtml(fi.name) + '</div>' +
                '<div class="item-desc">' + escapeHtml(fi.description || '') + '</div>' +
            '</div>' +
            '<div class="item-price-area">' +
                priceHTML +
                '<div class="item-stock">' + remaining + ' tilbage</div>' +
                (discountAvail ? '<span class="discount-badge">TILBUD</span>' : '') +
            '</div>' +
            '<div class="quantity-ctrl">' +
                '<button data-id="' + item.id + '" data-delta="-1" class="cart-btn" aria-label="Fjern én ' + escapeHtml(fi.name) + '">-</button>' +
                '<span id="qty-' + item.id + '" aria-live="polite">' + qty + '</span>' +
                '<button data-id="' + item.id + '" data-delta="1" class="cart-btn" aria-label="Tilføj én ' + escapeHtml(fi.name) + '">+</button>' +
            '</div>' +
            (chipsHtml ? '<div class="meta-chips" aria-label="Allergener og mærkning">' + chipsHtml + '</div>' : '');

        // Hover: show detail panel
        row.addEventListener('mouseenter', function() {
            showDetailPanel(detailId, fi);
            listContainer.querySelectorAll('.menu-item-row').forEach(function(r) { r.classList.remove('active-hover'); });
            row.classList.add('active-hover');
        });
        // Focus (keyboard) also shows detail panel
        row.addEventListener('focusin', function() {
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

    var html = '<div class="detail-panel-content">';
    html += '<h3>' + escapeHtml(fi.name) + '</h3>';

    if (fi.description) {
        html += '<p class="detail-desc">' + escapeHtml(fi.description) + '</p>';
    }

    // Halal status
    if (isHalal === true) {
        html += '<div class="detail-row"><span class="detail-label">Halal:</span><span class="detail-halal-badge">Halal</span></div>';
    } else if (isHalal === false) {
        html += '<div class="detail-row"><span class="detail-label">Halal:</span><span class="detail-not-halal-badge">Ikke halal</span></div>';
    }

    // Allergens
    if (allergens) {
        var tags = allergens.split(',').map(function(a) {
            return '<span class="detail-allergen-tag">' + escapeHtml(a.trim()) + '</span>';
        }).join(' ');
        html += '<div class="detail-row"><span class="detail-label">Allergener:</span><span class="detail-value">' + tags + '</span></div>';
    } else {
        html += '<div class="detail-row"><span class="detail-label">Allergener:</span><span class="detail-value" style="color:var(--text-muted);">Ingen</span></div>';
    }

    // Price info
    html += '<div class="detail-row"><span class="detail-label">Pris:</span><span class="detail-value">' +
        formatPrice(fi.base_price) + '</span></div>';
    if (Number(fi.discount_price) > 0 && Number(fi.discount_price) < Number(fi.base_price)) {
        html += '<div class="detail-row"><span class="detail-label">Rabatpris:</span><span class="detail-value" style="color:var(--danger);font-weight:600;">' +
            formatPrice(fi.discount_price) + '</span></div>';
    }

    // Extra info
    if (extraInfo) {
        html += '<div class="detail-extra">' + escapeHtml(extraInfo) + '</div>';
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
        document.getElementById('cartTotal').textContent = formatPrice(totalPrice);
    } else { bar.style.display = 'none'; }
}

// ════════════════════════════════════════════════════════
// PLACE ORDER
// ════════════════════════════════════════════════════════
async function placeOrder() {
    if (cart.length === 0) return;
    var isReservation = (reserveMenuData && reserveMenuData.erReservation) || false;
    if (buyMenuData && !buyMenuData.erReservation) isReservation = false;
    if (!buyMenuData && reserveMenuData) isReservation = true;
    var items = cart.flatMap(function(c) { return cartItemToOrderLines(c); });
    var res = await fetchJSON('/api/ordre', 'POST', { userId: currentUser.id, items: items, isReservation: isReservation });
    if (res.error) { showToast(friendlyError(res.error), 'error', 'Bestilling mislykkedes'); return; }
    var totalPrice = cartTotalPrice();
    showReceiptModal(res.ordre.receipt_code, totalPrice, isReservation);
    cart = [];
    updateCartBar();
    var activeSection = document.querySelector('.section.active');
    if (activeSection) {
        if (activeSection.id === 'buySection') loadBuySection();
        else if (activeSection.id === 'reserveSection') loadReserveSection();
    }
}

// ════════════════════════════════════════════════════════
// RECEIPT MODAL (Esc-close + focus-trap + focus-return)
// ════════════════════════════════════════════════════════
function showReceiptModal(code, total, isRes) {
    lastFocusedBeforeModal = document.activeElement;
    var overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'receiptModalTitle');

    var title = isRes ? 'Reservation bekræftet' : 'Betaling gennemført';
    overlay.innerHTML =
        '<div class="modal" role="document">' +
        '<button class="modal-close" id="modalCloseX" aria-label="Luk">' +
        '<svg width="20" height="20" aria-hidden="true"><use href="#ic-close"/></svg></button>' +
        '<h2 id="receiptModalTitle" style="color:var(--green-dark);font-weight:700;">' + title + '</h2>' +
        '<p style="color:var(--text-muted); margin-top:10px;">Vis denne kode i kantinen:</p>' +
        '<div class="receipt-code">' + escapeHtml(code) + '</div>' +
        '<p style="color:var(--text-muted);">Total: ' + formatPrice(total) + '</p>' +
        '<button class="modal-primary" id="closeModalBtn">Luk</button></div>';
    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector('#closeModalBtn');
    var closeX = overlay.querySelector('#modalCloseX');

    function closeModal() {
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);
        if (lastFocusedBeforeModal && lastFocusedBeforeModal.focus) {
            lastFocusedBeforeModal.focus();
        }
    }
    function onKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
        if (e.key === 'Tab') {
            // Focus trap: cycle between focusable elements
            var focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    closeBtn.addEventListener('click', closeModal);
    closeX.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', onKeydown);
    setTimeout(function() { closeBtn.focus(); }, 50);

    showToast(isRes ? 'Din reservation er gemt.' : 'Din bestilling er betalt.', 'success');
}

// ════════════════════════════════════════════════════════
// MINE ORDRER
// ════════════════════════════════════════════════════════
async function loadMineOrdrer() {
    var list = document.getElementById('ordrerList');
    var skelTimer = setTimeout(function() { renderSkeletonList('ordrerList', 3); }, 150);
    var ordrer = await fetchJSON('/api/ordrer/' + currentUser.id);
    clearTimeout(skelTimer);
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) {
        list.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-orders"/></svg>' +
            '<h3>Ingen ordrer endnu</h3>' +
            '<p>Når du bestiller mad, kan du finde dine kvitteringer her.</p>' +
            '<button class="btn-cta" onclick="showSection(\'buySection\')">Gå til menuen</button>' +
            '</div>';
        return;
    }

    var statusLabels = { reserved: 'Reserveret', paid: 'Betalt', picked_up: 'Afhentet', cancelled: 'Annulleret' };
    ordrer.forEach(function(o) {
        var card = document.createElement('div');
        card.classList.add('receipt-card');
        var dato = new Date(o.placed_at).toLocaleString('da-DK');
        var itemsHTML = '';
        if (o.order_items) {
            o.order_items.forEach(function(oi) {
                var fn = (oi.daily_menu && oi.daily_menu.food_items) ? oi.daily_menu.food_items.name : 'Ukendt ret';
                itemsHTML += '<div>' + oi.quantity + 'x ' + escapeHtml(fn) + ' — ' + formatPrice(oi.unit_price) + (oi.is_discounted ? ' (rabat)' : '') + '</div>';
            });
        }
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="color:var(--text-muted);font-size:0.85em;">' + dato + '</span>' +
            '<span class="status-badge status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></div>' +
            '<div class="receipt-code">' + escapeHtml(o.receipt_code) + '</div>' +
            '<div style="margin:10px 0;color:var(--text);">' + itemsHTML + '</div>' +
            '<div style="font-weight:700;color:var(--green-dark);">Total: ' + formatPrice(o.total_price) + '</div>';
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
        var rawName = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : 'Andet';
        var cn = daCategory(rawName);
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
        var rawName = (fi.food_categories && fi.food_categories.name) ? fi.food_categories.name : '';
        var cn = daCategory(rawName);
        opt.textContent = fi.name + ' (' + cn + ') — ' + formatPrice(fi.base_price);
        select.appendChild(opt);
    });
}

async function loadAdminMenuForDate() {
    var dato = document.getElementById('adminMenuDate').value;
    var grid = document.getElementById('adminMenuGrid');
    var skelTimer = setTimeout(function() { renderSkeletonList('adminMenuGrid', 3); }, 150);
    var menu = await fetchJSON('/api/menu/' + dato);
    clearTimeout(skelTimer);
    grid.innerHTML = '';
    if (!menu || menu.length === 0) {
        grid.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-menu"/></svg>' +
            '<h3>Ingen retter på menuen</h3>' +
            '<p>Tilføj retter herover for at bygge menuen for valgt dato.</p>' +
            '</div>';
        return;
    }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
            '<div><h3>' + escapeHtml(fi.name) + '</h3>' +
            '<div style="color:var(--text-muted);">Total: ' + item.total_quantity + ' | Solgt: ' + item.sold_quantity + ' | Tilbage: ' + rem + ' | Rabat: ' + item.discounted_quantity + '</div></div>' +
            '<button class="fjern-btn" data-mid="' + item.id + '" aria-label="Fjern ' + escapeHtml(fi.name) + ' fra menuen" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-family:inherit;font-weight:600;">Fjern</button>' +
            '</div>';
        grid.appendChild(card);
    });
}

async function adminFjernMenuItem(dailyMenuId) {
    var ok = await askConfirm('Fjern denne ret fra menuen?', 'Fjern', 'Annullér');
    if (!ok) return;
    var res = await fetchJSON('/api/menu/' + dailyMenuId, 'DELETE');
    if (res && res.error) {
        showToast(friendlyError(res.error), 'error', 'Kunne ikke fjerne');
        return;
    }
    showToast('Retten er fjernet fra menuen.', 'success');
    await loadAdminMenuForDate();
}

async function adminTilfoejMenu() {
    var foodItemId = document.getElementById('adminFoodSelect').value;
    var menuDate = document.getElementById('adminMenuDate').value;
    var totalQuantity = parseInt(document.getElementById('adminQuantity').value);
    if (!foodItemId || !menuDate || !totalQuantity) {
        showToast('Udfyld alle felter før du tilføjer.', 'warning', 'Manglende info');
        return;
    }
    var res = await fetchJSON('/api/menu/tilfoej', 'POST', { foodItemId: foodItemId, menuDate: menuDate, totalQuantity: totalQuantity });
    if (res && res.error) {
        showToast(friendlyError(res.error), 'error', 'Kunne ikke tilføje');
        return;
    }
    showToast('Retten er tilføjet til menuen.', 'success');
    await loadAdminMenuForDate();
}

// ════════════════════════════════════════════════════════
// ADMIN: ALL ORDERS
// ════════════════════════════════════════════════════════
async function loadAdminOrdrer() {
    var list = document.getElementById('adminOrdrerList');
    var dato = new Date().toISOString().split('T')[0];
    var skelTimer = setTimeout(function() { renderSkeletonList('adminOrdrerList', 3); }, 150);
    var ordrer = await fetchJSON('/api/ordrer/alle/' + dato);
    clearTimeout(skelTimer);
    list.innerHTML = '';
    if (!ordrer || ordrer.length === 0) {
        list.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-orders"/></svg>' +
            '<h3>Ingen ordrer i dag</h3>' +
            '<p>Ordrer vises her, så snart eleverne begynder at bestille.</p>' +
            '</div>';
        return;
    }

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
                ih += oi.quantity + 'x ' + escapeHtml(fn) + (oi.is_discounted ? ' (rabat)' : '') + ', ';
            });
        }
        var actionBtn = '';
        if (o.status !== 'picked_up' && o.status !== 'cancelled') {
            actionBtn = '<button class="admin-btn mark-btn" data-oid="' + o.id + '" style="margin-top:8px;">Markér som afhentet</button>';
        }
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
            '<strong>' + escapeHtml(o.receipt_code) + '</strong>' +
            '<span class="status-badge status-' + o.status + '">' + (statusLabels[o.status] || o.status) + '</span></div>' +
            '<div style="color:var(--text-muted);margin:6px 0;">' + escapeHtml(sn) + ' — ' + d + '</div>' +
            '<div style="color:var(--text);">' + ih + '</div>' +
            '<div style="color:var(--green-dark);font-weight:700;">' + formatPrice(o.total_price) +
            (o.is_reservation ? ' <span style="color:var(--warning);">(Reservation)</span>' : '') + '</div>' + actionBtn;
        list.appendChild(card);
    });
}

async function markPickedUp(ordreId) {
    var res = await fetchJSON('/api/ordre/status', 'POST', { ordreId: ordreId, nyStatus: 'picked_up' });
    if (res && res.error) { showToast(friendlyError(res.error), 'error'); return; }
    showToast('Ordre markeret som afhentet.', 'success');
    loadAdminOrdrer();
}

// ════════════════════════════════════════════════════════
// ADMIN: DISCOUNTS
// ════════════════════════════════════════════════════════
async function loadDiscountView() {
    var grid = document.getElementById('discountGrid');
    grid.innerHTML = '';

    var res = await fetchJSON('/api/menu');
    if (res.erReservation) {
        grid.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-menu"/></svg>' +
            '<h3>Rabatter kan ikke sættes lige nu</h3>' +
            '<p>Rabatter kan kun sættes i kantinens åbningstid (07:00-13:45).</p>' +
            '</div>';
        return;
    }

    var menu = res.menu || [];
    if (menu.length === 0) {
        grid.innerHTML =
            '<div class="empty-state">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-menu"/></svg>' +
            '<h3>Ingen menu i dag</h3>' +
            '<p>Tilføj retter til dagens menu, før du kan sætte rabatter.</p>' +
            '</div>';
        return;
    }
    menu.forEach(function(item) {
        var fi = item.food_items;
        var rem = item.total_quantity - item.sold_quantity;
        var card = document.createElement('div');
        card.classList.add('admin-card');
        card.innerHTML =
            '<h3>' + escapeHtml(fi.name) + '</h3>' +
            '<div style="color:var(--text-muted);margin-bottom:8px;">Tilbage: ' + rem + ' | Rabatpris: ' + formatPrice(fi.discount_price) + ' | Rabat på: ' + item.discounted_quantity + ' stk</div>' +
            '<label for="disc-' + item.id + '" style="color:var(--text);">Antal til rabat: </label>' +
            '<input type="number" id="disc-' + item.id + '" min="0" max="' + rem + '" value="' + item.discounted_quantity + '">' +
            '<button class="disc-btn" data-did="' + item.id + '">Opdatér</button>';
        grid.appendChild(card);
    });
}

async function setDiscount(dailyMenuId) {
    var input = document.getElementById('disc-' + dailyMenuId);
    var max = parseInt(input.max);
    var qty = Math.min(Math.max(0, parseInt(input.value) || 0), max);
    if (qty !== parseInt(input.value)) {
        showToast('Antal til rabat kan ikke overstige lageret (' + max + ' stk).', 'warning', 'Ugyldigt antal');
        input.value = qty;
        return;
    }
    var res = await fetchJSON('/api/menu/discount', 'POST', { dailyMenuId: dailyMenuId, discountedQuantity: qty });
    if (res && res.error) { showToast(friendlyError(res.error), 'error'); return; }
    showToast('Rabatten er opdateret.', 'success');
    loadDiscountView();
}

// ════════════════════════════════════════════════════════
// STATISTICS PANEL (D3.js charts)
// ════════════════════════════════════════════════════════
var statsRawData = [];
var statsDailyOrders = {};
var statsSelectedItems = {};
var statsColorMap = {};
var statsAllItems = [];
var statsPeriodDays = 7;
var statsCustomDate = null;

// New palette aligned with brand (green + orange + complementary data-viz hues)
var STATS_COLORS = [
    '#2E7D32', '#FF6F00', '#1565C0', '#8E24AA', '#00838F',
    '#6D4C41', '#C62828', '#F9A825', '#558B2F', '#283593',
    '#AD1457', '#00695C', '#4527A0', '#EF6C00', '#455A64',
    '#7B1FA2', '#33691E', '#D81B60', '#0277BD', '#5D4037'
];

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
        return (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name);
    });

    if (statsAllItems.length === 0) {
        noItems.style.display = 'block';
        return;
    }
    noItems.style.display = 'none';

    statsColorMap = {};
    statsAllItems.forEach(function(item, i) {
        statsColorMap[item.id] = STATS_COLORS[i % STATS_COLORS.length];
    });

    statsAllItems.forEach(function(item) {
        if (statsSelectedItems[item.id] === undefined) {
            statsSelectedItems[item.id] = true;
        }
    });

    statsAllItems.forEach(function(item) {
        var chip = document.createElement('button');
        chip.classList.add('stats-item-chip');
        chip.dataset.itemId = item.id;
        if (statsSelectedItems[item.id]) chip.classList.add('selected');
        chip.setAttribute('aria-pressed', statsSelectedItems[item.id] ? 'true' : 'false');
        chip.innerHTML = '<span class="chip-dot" style="background:' + statsColorMap[item.id] + '" aria-hidden="true"></span>' +
            '<span>' + escapeHtml(item.name) + '</span>';
        chip.addEventListener('click', function() {
            statsSelectedItems[item.id] = !statsSelectedItems[item.id];
            chip.classList.toggle('selected', statsSelectedItems[item.id]);
            chip.setAttribute('aria-pressed', statsSelectedItems[item.id] ? 'true' : 'false');
            renderChart();
            renderSummary();
        });
        container.appendChild(chip);
    });
}

function selectAllItems() {
    statsAllItems.forEach(function(item) { statsSelectedItems[item.id] = true; });
    document.querySelectorAll('.stats-item-chip').forEach(function(c) {
        c.classList.add('selected');
        c.setAttribute('aria-pressed', 'true');
    });
    renderChart();
    renderSummary();
}

function resetItemSelection() {
    statsAllItems.forEach(function(item) { statsSelectedItems[item.id] = false; });
    document.querySelectorAll('.stats-item-chip').forEach(function(c) {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
    });
    renderChart();
    renderSummary();
}

function getSelectedStatsData() {
    return statsRawData.filter(function(r) { return statsSelectedItems[r.food_item_id]; });
}

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
        chartDiv.innerHTML =
            '<div class="empty-state" style="border:none;box-shadow:none;padding:40px 20px;">' +
            '<svg class="empty-illustration" width="200" height="140" aria-hidden="true"><use href="#empty-stats"/></svg>' +
            '<h3>' + (statsRawData.length === 0 ? 'Ingen salgsdata' : 'Vælg mindst én ret') + '</h3>' +
            '<p>' + (statsRawData.length === 0 ? 'Der er ingen data i den valgte periode.' : 'Klik på en ret i listen herover for at vise den i grafen.') + '</p>' +
            '</div>';
        return;
    }

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

    var lookup = {};
    filtered.forEach(function(r) {
        var key = r.menu_date + '|' + r.food_item_id;
        lookup[key] = Number(r[metric]) || 0;
    });

    var range = statsDateRange();
    var isSingleDay = (range.from === range.to);
    var chartDates = isSingleDay ? dataDates : generateDateRange(range.from, range.to);

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

    itemIds.forEach(function(id) {
        var el = document.createElement('div');
        el.classList.add('stats-legend-item');
        el.innerHTML = '<span class="stats-legend-dot" style="background:' + statsColorMap[id] + '" aria-hidden="true"></span>' +
            '<span>' + escapeHtml(itemNames[id]) + '</span>';
        legendDiv.appendChild(el);
    });
}

function drawBarChart(svg, tooltip, date, itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue) {
    var barData = itemIds.map(function(id) {
        return { id: id, name: itemNames[id], val: lookup[date + '|' + id] || 0 };
    }).sort(function(a, b) { return b.val - a.val; });

    var x = d3.scaleBand()
        .domain(barData.map(function(d) { return d.id; }))
        .range([0, width])
        .padding(0.25);

    var y = d3.scaleLinear().domain([0, maxVal * 1.15 || 1]).nice().range([height, 0]);

    var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).tickFormat(function(id) { return itemNames[id]; }));
    xAxisG.selectAll('text')
        .attr('transform', 'rotate(-40)').style('text-anchor', 'end')
        .style('fill', '#4B5563').style('font-size', '10px').style('font-family', 'Inter, sans-serif');
    xAxisG.selectAll('line,path').style('stroke', '#D1D9E3');

    var yAxisG = svg.append('g').call(d3.axisLeft(y).ticks(6));
    yAxisG.selectAll('text').style('fill', '#4B5563').style('font-size', '11px').style('font-family', 'Inter, sans-serif');
    yAxisG.selectAll('line,path').style('stroke', '#D1D9E3');

    svg.append('text').attr('x', -height / 2).attr('y', -50).attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle').style('fill', '#4B5563').style('font-size', '11px').style('font-family', 'Inter, sans-serif').text(yLabel);

    var gridG = svg.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''));
    gridG.selectAll('line').style('stroke', '#E5EAF0').style('stroke-dasharray', '3,3');
    gridG.select('.domain').remove();

    svg.append('text')
        .attr('x', width / 2).attr('y', -6)
        .attr('text-anchor', 'middle')
        .style('fill', '#1F2937').style('font-size', '13px').style('font-weight', '600').style('font-family', 'Inter, sans-serif')
        .text(date);

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

    svg.selectAll('.bar-label').data(barData).enter()
        .append('text')
        .attr('x', function(d) { return x(d.id) + x.bandwidth() / 2; })
        .attr('y', function(d) { return y(d.val) - 6; })
        .attr('text-anchor', 'middle')
        .style('fill', '#1F2937').style('font-size', '11px').style('font-weight', '600').style('font-family', 'Inter, sans-serif')
        .text(function(d) { return d.val > 0 ? (isRevenue ? d.val.toFixed(0) : d.val) : ''; });
}

function drawMultiLineChart(svg, tooltip, dates, itemIds, itemNames, lookup, width, height, maxVal, yLabel, isRevenue) {
    var parseDate = d3.timeParse('%Y-%m-%d');
    var formatDate = d3.timeFormat('%d/%m');
    var timeDates = dates.map(function(d) { return parseDate(d); });

    var x = d3.scaleTime()
        .domain(d3.extent(timeDates))
        .range([0, width]);

    var y = d3.scaleLinear().domain([0, maxVal * 1.15 || 1]).nice().range([height, 0]);

    var tickCount = Math.min(dates.length, Math.max(4, Math.floor(width / 80)));
    var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).ticks(tickCount).tickFormat(formatDate));
    xAxisG.selectAll('text')
        .attr('transform', 'rotate(-35)').style('text-anchor', 'end')
        .style('fill', '#4B5563').style('font-size', '11px').style('font-family', 'Inter, sans-serif');
    xAxisG.selectAll('line,path').style('stroke', '#D1D9E3');

    var yAxisG = svg.append('g').call(d3.axisLeft(y).ticks(6));
    yAxisG.selectAll('text').style('fill', '#4B5563').style('font-size', '11px').style('font-family', 'Inter, sans-serif');
    yAxisG.selectAll('line,path').style('stroke', '#D1D9E3');

    svg.append('text').attr('x', -height / 2).attr('y', -50).attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle').style('fill', '#4B5563').style('font-size', '11px').style('font-family', 'Inter, sans-serif').text(yLabel);

    var gridG = svg.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(''));
    gridG.selectAll('line').style('stroke', '#E5EAF0').style('stroke-dasharray', '3,3');
    gridG.select('.domain').remove();

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

    var itemPoints = {};
    itemIds.forEach(function(id) {
        itemPoints[id] = dates.map(function(d) { return { date: d, val: lookup[d + '|' + id] || 0 }; });
    });

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

    var overlapSegments = [];
    for (var di = 0; di < dates.length - 1; di++) {
        var dA = dates[di], dB = dates[di + 1];
        var segMap = {};
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

    var defs = svg.append('defs');
    var gradientCounter = 0;

    itemIds.forEach(function(id) {
        var points = itemPoints[id];
        var color = statsColorMap[id];

        svg.append('path').datum(points)
            .attr('fill', color).attr('opacity', 0.05).attr('d', area);

        svg.append('path').datum(points)
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5)
            .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
            .attr('d', line);
    });

    overlapSegments.forEach(function(seg) {
        var xA = x(dateToTime[seg.dateA]);
        var yA = y(lookup[seg.dateA + '|' + seg.ids[0]] || 0);
        var xB = x(dateToTime[seg.dateB]);
        var yB = y(lookup[seg.dateB + '|' + seg.ids[0]] || 0);
        var colors = seg.ids.map(function(id) { return statsColorMap[id]; });

        gradientCounter++;
        var gradId = 'overlap-grad-' + gradientCounter;
        var segLen = Math.sqrt((xB - xA) * (xB - xA) + (yB - yA) * (yB - yA));
        var stripeWidth = 8;
        var totalPattern = stripeWidth * colors.length;

        var grad = defs.append('linearGradient')
            .attr('id', gradId)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', xA).attr('y1', yA)
            .attr('x2', xB).attr('y2', yB)
            .attr('spreadMethod', 'repeat');

        colors.forEach(function(c, i) {
            var startPct = (i / colors.length) * 100;
            var endPct = ((i + 1) / colors.length) * 100;
            grad.append('stop').attr('offset', startPct + '%').attr('stop-color', c);
            grad.append('stop').attr('offset', endPct + '%').attr('stop-color', c);
        });

        if (segLen > 0) {
            var ratio = totalPattern / segLen;
            var mx = xA + (xB - xA) * ratio;
            var my = yA + (yB - yA) * ratio;
            grad.attr('x2', mx).attr('y2', my);
        }

        svg.append('line')
            .attr('x1', xA).attr('y1', yA)
            .attr('x2', xB).attr('y2', yB)
            .attr('stroke', 'url(#' + gradId + ')')
            .attr('stroke-width', 3.5)
            .attr('stroke-linecap', 'round');
    });

    var showDots = dates.length <= 60;
    var dotGroups = [];

    dates.forEach(function(d) {
        var byVal = overlapByDate[d];
        for (var vk in byVal) {
            var ids = byVal[vk];
            var val = parseFloat(vk);
            dotGroups.push({ date: d, val: val, ids: ids });
        }
    });

    dotGroups.forEach(function(g) {
        var cx = x(dateToTime[g.date]);
        var cy = y(g.val);
        var colors = g.ids.map(function(id) { return statsColorMap[id]; });

        if (g.ids.length === 1) {
            svg.append('circle')
                .attr('cx', cx).attr('cy', cy)
                .attr('r', showDots ? 4.5 : 0)
                .attr('fill', colors[0])
                .attr('stroke', '#fff').attr('stroke-width', 2);
        } else {
            var r = showDots ? 7 : 0;
            if (r > 0) {
                drawPieDot(svg, cx, cy, r, colors);
            }
        }
    });

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

function tooltipHtmlMulti(names, colors, date, val, isRevenue) {
    var valStr = isRevenue ? formatPrice(val) : val + ' stk';
    var html = '<span style="color:#4B5563;">' + date + '</span> — ' + valStr + '<br>';
    names.forEach(function(name, i) {
        html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
            colors[i] + ';margin-right:6px;vertical-align:middle;"></span>' +
            '<strong>' + escapeHtml(name) + '</strong>';
        if (i < names.length - 1) html += '<br>';
    });
    return html;
}

function tooltipHtml(name, date, val, isRevenue) {
    return '<strong>' + escapeHtml(name) + '</strong><br>' +
        '<span style="color:#4B5563;">' + date + '</span><br>' +
        (isRevenue ? formatPrice(val) : val + ' stk');
}

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

    var totalOrders = 0;
    Object.keys(uniqueDays).forEach(function(d) {
        totalOrders += statsDailyOrders[d] || 0;
    });

    var cards = [
        { label: 'Antal solgt', value: totalSold + ' stk' },
        { label: 'Omsætning', value: formatPrice(totalRevenue), blue: true },
        { label: 'Gns. pr. dag', value: formatPrice(totalRevenue / dayCount), blue: true },
        { label: 'Ordrer', value: totalOrders || '—' },
        { label: 'Reservationer', value: totalReservations + ' stk' },
        { label: 'Direkte køb', value: totalDirectPurchases + ' stk' },
        { label: 'Afhentet', value: totalPickedUp + ' stk' },
        { label: 'Annulleret', value: totalCancelled + ' stk' },
        { label: 'Rabat-salg', value: totalDiscountedSold + ' stk' },
        { label: 'Rabat-omsætning', value: formatPrice(totalDiscountedRevenue), blue: true },
        { label: 'Unikke retter', value: Object.keys(uniqueItems).length },
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
// FETCH HELPER
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
