import datalag from './cantineDatalag.js';

// Laget imellem præsentationslag (routing) og datalag.

// Kantinen har åbent 07:00–13:45. Værdierne er antal minutter siden midnat.
const AABNINGSTID_MIN = 7 * 60;            // 07:00
const LUKKETID_MIN    = 13 * 60 + 45;      // 13:45

async function signUp(email, password, fullName) {
    return await datalag.signUp(email, password, fullName);
}

async function signIn(email, password) {
    return await datalag.signIn(email, password);
}

function getDatoIdag() {
    return new Date().toISOString().split('T')[0];
}

function getDatoIMorgen() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function getMinsSinceMidnight() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function erKantinenAaben() {
    const mins = getMinsSinceMidnight();
    return mins >= AABNINGSTID_MIN && mins < LUKKETID_MIN;
}

function erReservationsperiode() {
    const mins = getMinsSinceMidnight();
    return mins >= LUKKETID_MIN || mins < AABNINGSTID_MIN;
}

async function hentMenu() {
    const reservation = erReservationsperiode();
    const dato = reservation ? getDatoIMorgen() : getDatoIdag();
    const menu = await datalag.hentDagensMenu(dato);
    return {
        menu: menu || [],
        dato: dato,
        erReservation: reservation
    };
}

async function hentMenuForDato(dato) {
    const menu = await datalag.hentDagensMenu(dato);
    return menu || [];
}

async function hentAlleFoodItems() {
    const items = await datalag.hentAlleFoodItems();
    return items || [];
}

async function tilføjTilDagensMenu(foodItemId, menuDate, totalQuantity) {
    return await datalag.tilføjTilDagensMenu(foodItemId, menuDate, totalQuantity);
}

async function fjernFraDagensMenu(dailyMenuId) {
    return await datalag.fjernFraDagensMenu(dailyMenuId);
}

async function opdaterDiscount(dailyMenuId, discountedQuantity) {
    if (!erKantinenAaben()) {
        return { error: 'Rabatter kan kun sættes i kantinens åbningstid (07:00-13:45)' };
    }
    return await datalag.opdaterDiscount(dailyMenuId, discountedQuantity);
}

async function opretOrdre(userId, items, isReservation) {
    let totalPrice = 0;
    for (const item of items) {
        totalPrice += item.unit_price * item.quantity;
    }
    totalPrice = Math.round(totalPrice * 100) / 100;
    const receiptCode = await datalag.genererKvitteringskode();
    return await datalag.opretOrdre(userId, items, totalPrice, isReservation, receiptCode);
}

async function hentMineOrdrer(userId) {
    return (await datalag.hentMineOrdrer(userId)) || [];
}

async function hentAlleOrdrer(dato) {
    return (await datalag.hentAlleOrdrer(dato)) || [];
}

async function opdaterOrdreStatus(ordreId, nyStatus) {
    return await datalag.opdaterOrdreStatus(ordreId, nyStatus);
}

async function hentKategorier() {
    return (await datalag.hentKategorier()) || [];
}

async function annullerIkkeAfhentedeOrdrer() {
    const dato = getDatoIdag();
    const result = await datalag.annullerIkkeAfhentedeOrdrer(dato);
    if (result && result.length > 0) {
        console.log('Annullerede ' + result.length + ' ikke-afhentede ordrer for ' + dato);
    }
    return result;
}

async function hentSalgsStatistik(startDato, slutDato) {
    const raw = (await datalag.hentSalgsStatistik(startDato, slutDato)) || [];

    // aggreger rå order_items til: per food_item per dato med alle metrics
    const map = {};
    const ordersByDate = {};

    for (const row of raw) {
        const dm = row.daily_menu;
        if (!dm || !dm.food_items) continue;
        const fi = dm.food_items;
        const order = row.orders;
        const key = fi.id + '|' + dm.menu_date;

        if (!map[key]) {
            map[key] = {
                food_item_id: fi.id,
                item_name: fi.name,
                category_name: fi.food_categories ? fi.food_categories.name : '',
                menu_date: dm.menu_date,
                total_sold: 0, total_revenue: 0,
                discounted_sold: 0, discounted_revenue: 0,
                full_price_sold: 0, full_price_revenue: 0,
                reservations: 0, direct_purchases: 0,
                picked_up: 0, cancelled: 0
            };
        }

        const isCancelled = order && order.status === 'cancelled';

        if (isCancelled) {
            map[key].cancelled += row.quantity;
        } else {
            map[key].total_sold += row.quantity;
            map[key].total_revenue += row.quantity * Number(row.unit_price);

            if (row.is_discounted) {
                map[key].discounted_sold += row.quantity;
                map[key].discounted_revenue += row.quantity * Number(row.unit_price);
            } else {
                map[key].full_price_sold += row.quantity;
                map[key].full_price_revenue += row.quantity * Number(row.unit_price);
            }

            if (order && order.is_reservation) {
                map[key].reservations += row.quantity;
            } else {
                map[key].direct_purchases += row.quantity;
            }

            if (order && order.status === 'picked_up') {
                map[key].picked_up += row.quantity;
            }
        }

        // track unique orders per date
        const dateKey = dm.menu_date;
        if (!ordersByDate[dateKey]) ordersByDate[dateKey] = new Set();
        const oid = (order && order.id) || row.order_id;
        if (oid) ordersByDate[dateKey].add(oid);
    }

    const items = Object.values(map);
    items.sort((a, b) => a.menu_date.localeCompare(b.menu_date) || a.item_name.localeCompare(b.item_name));

    // daily order counts
    const dailyOrders = {};
    for (const [date, set] of Object.entries(ordersByDate)) {
        dailyOrders[date] = set.size;
    }

    return { items, dailyOrders };
}

export default {
    signUp, signIn,
    hentMenu, hentMenuForDato, hentAlleFoodItems,
    tilføjTilDagensMenu, opdaterDiscount, fjernFraDagensMenu,
    opretOrdre, hentMineOrdrer, hentAlleOrdrer, opdaterOrdreStatus,
    hentKategorier, getDatoIdag, getDatoIMorgen,
    erReservationsperiode, erKantinenAaben,
    hentSalgsStatistik, annullerIkkeAfhentedeOrdrer
};
