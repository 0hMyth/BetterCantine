// Run: node seed_test_data.js
// Seeds the database with realistic sales data over the past 14 days.

import { supabase } from './config.js';

async function seed() {
    console.log('Fetching food items and admin user...');

    const { data: foodItems } = await supabase.from('food_items').select('id, name, base_price, discount_price, category_id').eq('is_active', true);
    const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();

    if (!foodItems || foodItems.length === 0) { console.log('No food items found!'); return; }
    if (!admin) { console.log('No admin user found!'); return; }

    const userId = admin.id;
    const today = new Date();

    // Generate data for the past 14 days
    for (let daysAgo = 0; daysAgo < 14; daysAgo++) {
        const date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        const dateStr = date.toISOString().split('T')[0];

        // Pick 8-15 random items for the daily menu
        const shuffled = [...foodItems].sort(() => Math.random() - 0.5);
        const menuItems = shuffled.slice(0, 8 + Math.floor(Math.random() * 8));

        console.log(`\n--- ${dateStr}: ${menuItems.length} menu items ---`);

        // Create daily_menu entries (upsert to avoid duplicates)
        const dailyMenuEntries = [];
        for (const fi of menuItems) {
            const totalQty = 10 + Math.floor(Math.random() * 30);
            const discountQty = Math.random() > 0.6 ? Math.floor(totalQty * 0.3) : 0;

            // Check if already exists
            const { data: existing } = await supabase.from('daily_menu')
                .select('id, total_quantity')
                .eq('food_item_id', fi.id)
                .eq('menu_date', dateStr)
                .maybeSingle();

            let dmId;
            if (existing) {
                dmId = existing.id;
                // Update quantity to ensure enough stock
                await supabase.from('daily_menu')
                    .update({ total_quantity: Math.max(existing.total_quantity, totalQty) })
                    .eq('id', existing.id);
            } else {
                const { data: inserted } = await supabase.from('daily_menu')
                    .insert({ food_item_id: fi.id, menu_date: dateStr, total_quantity: totalQty, sold_quantity: 0, discounted_quantity: discountQty })
                    .select('id')
                    .single();
                if (!inserted) continue;
                dmId = inserted.id;
            }

            dailyMenuEntries.push({ dmId, fi, discountQty });
        }

        // Create 3-8 orders per day
        const numOrders = 3 + Math.floor(Math.random() * 6);
        for (let o = 0; o < numOrders; o++) {
            // Pick 1-4 items for this order
            const numItems = 1 + Math.floor(Math.random() * 4);
            const orderMenuItems = [...dailyMenuEntries].sort(() => Math.random() - 0.5).slice(0, numItems);

            const isReservation = Math.random() > 0.7;
            const statuses = isReservation
                ? ['reserved', 'picked_up', 'cancelled']
                : ['paid', 'picked_up', 'cancelled'];
            const statusWeights = isReservation
                ? [0.3, 0.6, 0.1]
                : [0.3, 0.6, 0.1];
            const rand = Math.random();
            let status;
            if (rand < statusWeights[0]) status = statuses[0];
            else if (rand < statusWeights[0] + statusWeights[1]) status = statuses[1];
            else status = statuses[2];

            // Build order items
            let totalPrice = 0;
            const orderLines = [];
            for (const entry of orderMenuItems) {
                const qty = 1 + Math.floor(Math.random() * 3);
                const isDisc = entry.discountQty > 0 && Math.random() > 0.5;
                const unitPrice = isDisc ? Number(entry.fi.discount_price) : Number(entry.fi.base_price);
                totalPrice += qty * unitPrice;
                orderLines.push({
                    daily_menu_id: entry.dmId,
                    quantity: qty,
                    unit_price: unitPrice,
                    is_discounted: isDisc
                });
            }
            totalPrice = Math.round(totalPrice * 100) / 100;

            // Generate receipt code
            const { data: receiptCode } = await supabase.rpc('generate_receipt_code');
            if (!receiptCode) continue;

            // Create the placed_at timestamp at a random hour during the day
            const placedAt = new Date(dateStr + 'T' + String(7 + Math.floor(Math.random() * 7)).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0') + ':00Z');

            const { data: order, error: orderErr } = await supabase.from('orders')
                .insert({
                    user_id: userId,
                    status: status,
                    is_reservation: isReservation,
                    receipt_code: receiptCode,
                    total_price: totalPrice,
                    placed_at: placedAt.toISOString()
                })
                .select('id')
                .single();

            if (orderErr) { console.log('Order error:', orderErr.message); continue; }

            // Insert order items (trigger will update sold_quantity)
            const itemsToInsert = orderLines.map(l => ({ ...l, order_id: order.id }));
            const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsErr) { console.log('Items error:', itemsErr.message); continue; }

            console.log(`  Order ${receiptCode}: ${status}, ${orderLines.length} items, ${totalPrice} DKK`);
        }
    }

    console.log('\nDone seeding test data!');
}

seed().catch(console.error);
