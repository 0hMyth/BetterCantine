import datalag from './cantineDatalag.js';

// laget imellem praesentationslag (routing) og datalag

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
    return mins >= 7 * 60 && mins < 13 * 60 + 45;
}

function erReservationsperiode() {
    const mins = getMinsSinceMidnight();
    return mins >= 13 * 60 + 45 || mins < 7 * 60;
}

function erKantinenLukket() {
    return false;
}

async function hentMenu() {
    const reservation = erReservationsperiode();
    const dato = reservation ? getDatoIMorgen() : getDatoIdag();
    const menu = await datalag.hentDagensMenu(dato);
    return {
        menu: menu || [],
        dato: dato,
        erReservation: reservation,
        erLukket: false
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

async function tilfoejTilDagensMenu(foodItemId, menuDate, totalQuantity) {
    return await datalag.tilfoejTilDagensMenu(foodItemId, menuDate, totalQuantity);
}

async function fjernFraDagensMenu(dailyMenuId) {
    return await datalag.fjernFraDagensMenu(dailyMenuId);
}

async function opdaterDiscount(dailyMenuId, discountedQuantity) {
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

export default {
    signUp, signIn,
    hentMenu, hentMenuForDato, hentAlleFoodItems,
    tilfoejTilDagensMenu, opdaterDiscount, fjernFraDagensMenu,
    opretOrdre, hentMineOrdrer, hentAlleOrdrer, opdaterOrdreStatus,
    hentKategorier, getDatoIdag, getDatoIMorgen,
    erReservationsperiode, erKantinenAaben, erKantinenLukket
};
