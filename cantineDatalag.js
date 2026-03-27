import { supabase } from './config.js';

// AUTH - simpel login/signup direkte mod profiles-tabellen
async function signUp(email, password, fullName) {
    // tjek om email allerede findes
    const { data: existing } = await supabase
        .from('profiles').select('id').eq('email', email).maybeSingle();
    if (existing) return { data: null, error: { message: 'Email er allerede i brug' } };

    const { data, error } = await supabase
        .from('profiles')
        .insert({ email, password, full_name: fullName, role: 'student' })
        .select()
        .single();
    if (error) { console.log('signUp fejl:', error); return { data: null, error }; }
    return { data, error: null };
}

async function signIn(email, password) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .maybeSingle();
    if (error) { console.log('signIn fejl:', error); return { data: null, error }; }
    if (!data) return { data: null, error: { message: 'Forkert email eller adgangskode' } };
    return { data, error: null };
}

// MENU
async function hentDagensMenu(dato) {
    const query = 'id, food_item_id, menu_date, total_quantity, sold_quantity, discounted_quantity, food_items ( id, name, description, base_price, discount_price, category_id, image_url, food_categories ( id, name ) )';
    const { data, error } = await supabase.from('daily_menu').select(query).eq('menu_date', dato);
    if (error) console.log('hentDagensMenu fejl:', error);
    return data;
}

async function hentAlleFoodItems() {
    const { data, error } = await supabase.from('food_items')
        .select('*, food_categories ( id, name )').eq('is_active', true).order('category_id');
    if (error) console.log('hentAlleFoodItems fejl:', error);
    return data;
}

async function tilfoejTilDagensMenu(foodItemId, menuDate, totalQuantity) {
    // check if item already exists on this date
    const { data: existing } = await supabase.from('daily_menu')
        .select('id, total_quantity')
        .eq('food_item_id', foodItemId)
        .eq('menu_date', menuDate)
        .maybeSingle();

    if (existing) {
        // add to existing quantity instead of replacing
        const newTotal = existing.total_quantity + totalQuantity;
        const { data, error } = await supabase.from('daily_menu')
            .update({ total_quantity: newTotal })
            .eq('id', existing.id)
            .select();
        if (error) console.log('tilfoejTilDagensMenu fejl:', error);
        return data;
    } else {
        const { data, error } = await supabase.from('daily_menu')
            .insert({ food_item_id: foodItemId, menu_date: menuDate, total_quantity: totalQuantity,
                sold_quantity: 0, discounted_quantity: 0 }).select();
        if (error) console.log('tilfoejTilDagensMenu fejl:', error);
        return data;
    }
}

async function fjernFraDagensMenu(dailyMenuId) {
    await supabase.from('order_items').delete().eq('daily_menu_id', dailyMenuId);
    const { data, error } = await supabase.from('daily_menu').delete().eq('id', dailyMenuId).select();
    if (error) console.log('fjernFraDagensMenu fejl:', error);
    return data;
}

async function opdaterDiscount(dailyMenuId, discountedQuantity) {
    const { data, error } = await supabase.from('daily_menu')
        .update({ discounted_quantity: discountedQuantity }).eq('id', dailyMenuId).select();
    if (error) console.log('opdaterDiscount fejl:', error);
    return data;
}

// ORDRER
async function opretOrdre(userId, items, totalPrice, isReservation, receiptCode) {
    const { data: ordre, error: ordreError } = await supabase.from('orders')
        .insert({ user_id: userId, status: isReservation ? 'reserved' : 'paid',
            is_reservation: isReservation, receipt_code: receiptCode, total_price: totalPrice })
        .select().single();
    if (ordreError) { console.log('opretOrdre fejl:', ordreError); return { data: null, error: ordreError }; }

    const orderItems = items.map(item => ({
        order_id: ordre.id, daily_menu_id: item.daily_menu_id,
        quantity: item.quantity, unit_price: item.unit_price, is_discounted: item.is_discounted
    }));
    const { data: linjer, error: linjerError } = await supabase.from('order_items').insert(orderItems).select();
    if (linjerError) { console.log('linjer fejl:', linjerError); return { data: null, error: linjerError }; }
    return { data: { ordre, linjer }, error: null };
}

async function hentMineOrdrer(userId) {
    const q = '*, order_items ( *, daily_menu ( *, food_items ( name ) ) )';
    const { data, error } = await supabase.from('orders').select(q)
        .eq('user_id', userId).order('placed_at', { ascending: false });
    if (error) console.log('hentMineOrdrer fejl:', error);
    return data;
}

async function hentAlleOrdrer(dato) {
    const q = '*, profiles ( full_name, email ), order_items ( *, daily_menu ( *, food_items ( name ) ) )';
    const { data, error } = await supabase.from('orders').select(q)
        .gte('placed_at', dato + 'T00:00:00').lte('placed_at', dato + 'T23:59:59')
        .order('placed_at', { ascending: false });
    if (error) console.log('hentAlleOrdrer fejl:', error);
    return data;
}

async function opdaterOrdreStatus(ordreId, nyStatus) {
    const { data, error } = await supabase.from('orders')
        .update({ status: nyStatus }).eq('id', ordreId).select();
    if (error) console.log('opdaterOrdreStatus fejl:', error);
    return data;
}

async function genererKvitteringskode() {
    const { data, error } = await supabase.rpc('generate_receipt_code');
    if (error) console.log('genererKvitteringskode fejl:', error);
    return data;
}

async function hentKategorier() {
    const { data, error } = await supabase.from('food_categories').select('*').order('id');
    if (error) console.log('hentKategorier fejl:', error);
    return data;
}

export default {
    signUp, signIn,
    hentDagensMenu, hentAlleFoodItems, tilfoejTilDagensMenu, fjernFraDagensMenu, opdaterDiscount,
    opretOrdre, hentMineOrdrer, hentAlleOrdrer, opdaterOrdreStatus,
    genererKvitteringskode, hentKategorier
};
