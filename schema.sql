-- ============================================================
-- BetterCantine - Database Schema
-- Run in Supabase Dashboard -> SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bruger-profiler med email/password login og rolle
CREATE TABLE profiles (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT        NOT NULL UNIQUE,
    password    TEXT        NOT NULL,
    full_name   TEXT        NOT NULL,
    role        TEXT        NOT NULL DEFAULT 'student'
                            CHECK (role IN ('student', 'admin')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Madvare-kategorier (3NF normalisering)
CREATE TABLE food_categories (
    id    SERIAL  PRIMARY KEY,
    name  TEXT    NOT NULL UNIQUE
);

-- Madvarer med priser og kategori-reference
CREATE TABLE food_items (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT         NOT NULL,
    description     TEXT,
    base_price      NUMERIC(8,2) NOT NULL CHECK (base_price >= 0),
    discount_price  NUMERIC(8,2) NOT NULL CHECK (discount_price >= 0),
    category_id     INT          NOT NULL REFERENCES food_categories(id),
    image_url       TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Daglig menu: hvilke madvarer er tilgængelige på en given dato
CREATE TABLE daily_menu (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    food_item_id        UUID    NOT NULL REFERENCES food_items(id),
    menu_date           DATE    NOT NULL,
    total_quantity      INT     NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    sold_quantity       INT     NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
    discounted_quantity INT     NOT NULL DEFAULT 0 CHECK (discounted_quantity >= 0),
    UNIQUE (food_item_id, menu_date)
);

-- Ordrer placeret af brugere
CREATE TABLE orders (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL REFERENCES profiles(id),
    placed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    status          TEXT         NOT NULL DEFAULT 'paid'
                                 CHECK (status IN ('reserved','paid','picked_up','cancelled')),
    is_reservation  BOOLEAN      NOT NULL DEFAULT FALSE,
    receipt_code    TEXT         NOT NULL UNIQUE,
    total_price     NUMERIC(8,2) NOT NULL CHECK (total_price >= 0)
);

-- Ordre-linjer: hvilke varer indgaar i en ordre
CREATE TABLE order_items (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    daily_menu_id   UUID         NOT NULL REFERENCES daily_menu(id),
    quantity        INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price      NUMERIC(8,2) NOT NULL CHECK (unit_price >= 0),
    is_discounted   BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Indekser for hurtigere opslag
CREATE INDEX idx_daily_menu_date ON daily_menu (menu_date);
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_receipt ON orders (receipt_code);
CREATE INDEX idx_order_items_order ON order_items (order_id);

-- Trigger: opdater sold_quantity automatisk når en ordre-linje oprettes
CREATE OR REPLACE FUNCTION increment_sold_quantity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE daily_menu SET sold_quantity = sold_quantity + NEW.quantity
    WHERE id = NEW.daily_menu_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_item_inserted
    AFTER INSERT ON order_items
    FOR EACH ROW EXECUTE FUNCTION increment_sold_quantity();

-- Genererer unik kvitteringskode (f.eks. BC-A3KM7N)
CREATE OR REPLACE FUNCTION generate_receipt_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code  TEXT := 'BC-';
    i     INT;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Seed-data: kategorier, madvarer og admin-konto
-- ============================================================

INSERT INTO food_categories (name) VALUES ('Main'), ('Drink'), ('Snack'), ('Dessert');

INSERT INTO food_items (name, description, base_price, discount_price, category_id) VALUES
    ('Pizza Margherita', 'Classic tomato sauce and mozzarella', 35.00, 15.00, 1),
    ('Pizza Pepperoni', 'Pepperoni with extra cheese', 38.00, 15.00, 1),
    ('Chicken Sandwich', 'Grilled chicken, lettuce and mayo', 32.00, 12.00, 1),
    ('Veggie Wrap', 'Mixed vegetables and hummus', 28.00, 12.00, 1),
    ('Pasta Bolognese', 'Spaghetti with beef bolognese', 35.00, 15.00, 1),
    ('Hotdog', 'Classic Danish hotdog', 22.00, 10.00, 1),
    ('Falafel Pita', 'Crispy falafel with tzatziki', 30.00, 12.00, 1),
    ('Fish Burger', 'Breaded fish fillet with remoulade', 34.00, 14.00, 1),
    ('Water (50cl)', 'Still mineral water', 8.00, 4.00, 2),
    ('Cola (33cl)', 'Chilled can of cola', 12.00, 6.00, 2),
    ('Lemonade (33cl)', 'Sparkling lemon soda', 12.00, 6.00, 2),
    ('Orange Juice (25cl)', 'Cold-pressed OJ', 14.00, 7.00, 2),
    ('Chocolate Milk (25cl)', 'Cold chocolate milk', 10.00, 5.00, 2),
    ('Banana', 'Fresh banana', 5.00, 2.00, 3),
    ('Apple', 'Fresh apple', 5.00, 2.00, 3),
    ('Fruit Cup', 'Mixed seasonal fruit', 15.00, 7.00, 3),
    ('Chips (small bag)', 'Salted potato crisps', 10.00, 5.00, 3),
    ('Granola Bar', 'Oat and honey bar', 8.00, 4.00, 3),
    ('Chocolate Muffin', 'Chocolate chip muffin', 18.00, 8.00, 4),
    ('Vanilla Yoghurt', 'Greek yoghurt with vanilla', 14.00, 7.00, 4),
    ('Cinnamon Roll', 'Freshly baked cinnamon roll', 16.00, 7.00, 4);

INSERT INTO profiles (email, password, full_name, role)
VALUES ('admin@bettercantine.dk', 'admin123', 'Canteen Admin', 'admin');
