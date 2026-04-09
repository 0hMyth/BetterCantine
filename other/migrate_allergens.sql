-- Run this in Supabase Dashboard -> SQL Editor
-- Adds allergen, halal, and extra info fields to food_items

ALTER TABLE food_items ADD COLUMN IF NOT EXISTS allergens TEXT DEFAULT '';
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS is_halal BOOLEAN DEFAULT FALSE;
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS extra_info TEXT DEFAULT '';

-- Update existing items with realistic data
UPDATE food_items SET allergens = 'Gluten, Mælk', is_halal = true, extra_info = 'Vegetarisk. Bagt i stenovn.' WHERE name = 'Pizza Margherita';
UPDATE food_items SET allergens = 'Gluten, Mælk', is_halal = false, extra_info = 'Indeholder svinekød.' WHERE name = 'Pizza Pepperoni';
UPDATE food_items SET allergens = 'Gluten, Æg, Mælk', is_halal = true, extra_info = 'Grillet kyllingebryst. Kan indeholde sennep.' WHERE name = 'Chicken Sandwich';
UPDATE food_items SET allergens = 'Gluten, Sesam', is_halal = true, extra_info = 'Vegansk. Indeholder hummus (kikærter, sesam).' WHERE name = 'Veggie Wrap';
UPDATE food_items SET allergens = 'Gluten, Mælk', is_halal = true, extra_info = 'Oksekød. Serveres med parmesan.' WHERE name = 'Pasta Bolognese';
UPDATE food_items SET allergens = 'Gluten, Sennep', is_halal = false, extra_info = 'Klassisk dansk hotdog med svinepølse. Serveres med remoulade, ketchup og sennep.' WHERE name = 'Hotdog';
UPDATE food_items SET allergens = 'Gluten, Sesam, Mælk', is_halal = true, extra_info = 'Vegansk mulighed (uden tzatziki). Friturestegte falafler.' WHERE name = 'Falafel Pita';
UPDATE food_items SET allergens = 'Gluten, Fisk, Æg', is_halal = true, extra_info = 'MSC-certificeret fisk. Paneret i rasp.' WHERE name = 'Fish Burger';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = '' WHERE name = 'Water (50cl)';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = 'Indeholder koffein og sukker.' WHERE name = 'Cola (33cl)';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = 'Danskvand med citronsmag.' WHERE name = 'Lemonade (33cl)';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = 'Koldpresset. Uden tilsat sukker.' WHERE name = 'Orange Juice (25cl)';
UPDATE food_items SET allergens = 'Mælk', is_halal = true, extra_info = 'Indeholder mælk og kakao.' WHERE name = 'Chocolate Milk (25cl)';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = '' WHERE name = 'Banana';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = '' WHERE name = 'Apple';
UPDATE food_items SET allergens = '', is_halal = true, extra_info = 'Sæsonens frugter. Kan variere.' WHERE name = 'Fruit Cup';
UPDATE food_items SET allergens = 'Mælk', is_halal = true, extra_info = 'Kartoffelchips med havsalt.' WHERE name = 'Chips (small bag)';
UPDATE food_items SET allergens = 'Gluten, Nødder', is_halal = true, extra_info = 'Indeholder havre og honning. Kan indeholde spor af nødder.' WHERE name = 'Granola Bar';
UPDATE food_items SET allergens = 'Gluten, Æg, Mælk', is_halal = true, extra_info = 'Bagt i kantinens køkken. Indeholder chokoladestykker.' WHERE name = 'Chocolate Muffin';
UPDATE food_items SET allergens = 'Mælk', is_halal = true, extra_info = 'Græsk yoghurt med vaniljeekstrakt.' WHERE name = 'Vanilla Yoghurt';
UPDATE food_items SET allergens = 'Gluten, Mælk, Æg', is_halal = true, extra_info = 'Friskbagt hver morgen. Indeholder kanel og kardemomme.' WHERE name = 'Cinnamon Roll';
