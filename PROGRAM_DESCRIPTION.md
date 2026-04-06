# BetterCantine - Program Description

## Overview

BetterCantine is a web-based canteen ordering system built with a **three-layer architecture** (trelagsmodel). Students can browse the daily menu, add items to a cart, and place orders (or reservations outside opening hours). Admins can manage the menu, view orders, set discounts, and analyze sales statistics with interactive D3.js charts.

The backend is **Node.js + Express**, the frontend is **vanilla HTML/CSS/JS**, and the database is **PostgreSQL via Supabase**.

---

## Architecture (Trelagsmodel)

```
Presentation Layer          Service Layer              Data Access Layer
(public/index.html)    (cantineServicelag.js)       (cantineDatalag.js)
(public/main.js)              |                           |
       |                      |                           |
   HTTP requests         Business logic              Supabase queries
       |                 (time checks,               (CRUD operations)
       v                  aggregation,                    |
   server.js             price calc)                      v
   (Express routes)           |                      PostgreSQL
       |                      |                      (Supabase)
       +----------+-----------+
```

### Layer Responsibilities

| Layer | Files | Role |
|-------|-------|------|
| **Presentation** | `public/index.html`, `public/main.js` | UI rendering, user interaction, fetch calls to API |
| **Routing** | `server.js` | Express routes that map HTTP endpoints to service functions |
| **Service** | `cantineServicelag.js` | Business logic: time-based rules, price calculation, data aggregation |
| **Data Access** | `cantineDatalag.js` | All Supabase database queries (select, insert, update, delete) |
| **Config** | `config.js` | Supabase client initialization using `.env` credentials |

---

## Database (6 tables, 3NF)

All tables are in **third normal form** (3NF). Categories are normalized into their own lookup table to avoid transitive dependencies.

### Tables

**profiles** - User accounts with email/password login and role (student or admin).

**food_categories** - Lookup table for item categories (Main, Drink, Snack, Dessert).

**food_items** - All available food/drink items with base price, discount price, and category reference.

**daily_menu** - Which food items are available on which date, with quantity tracking (total, sold, discounted).

**orders** - Placed orders with status (reserved/paid/picked_up/cancelled), receipt code, and total price.

**order_items** - Individual line items within an order, referencing the daily menu entry.

### Key Relations

```
profiles (1) ---< (M) orders (1) ---< (M) order_items (M) >--- (1) daily_menu (M) >--- (1) food_items (M) >--- (1) food_categories
```

### Triggers & Functions

- **`increment_sold_quantity`** - Trigger on `order_items` INSERT that automatically updates `daily_menu.sold_quantity`.
- **`generate_receipt_code`** - Function that generates a unique receipt code like `BC-A3KM7N`.

---

## Features

### Student Features

1. **Sign up / Log in** - Simple email + password auth against `profiles` table.
2. **Browse menu** - See today's menu with prices, stock, and discount badges.
3. **Cart system** - Add/remove items, see running total. Discount prices applied automatically up to the discounted quantity limit.
4. **Place order / Reserve** - Between 07:00-13:45 (open hours): orders are placed as "paid". Between 13:45-07:00 (reservation period): orders are placed as "reserved" for the next day.
5. **Receipt code** - After ordering, a unique receipt code is shown to present at the canteen.
6. **Order history** - View all past orders with status and items.

### Admin Features

1. **Manage menu** - Add food items to a specific date's menu with quantity. Filter items by category tabs. Remove items from the menu.
2. **View all orders** - See all orders placed today with customer name, items, status. Mark orders as picked up.
3. **Set discounts** - Set how many units of each item should be sold at the discount price.
4. **Sales statistics (D3.js)** - Interactive charts showing sales data:
   - **Period selector**: 1 day, 1 week, 1 month, 6 months, 1 year
   - **Metric toggle**: number sold vs. revenue (DKK)
   - **Chart type**: bar chart or line chart
   - **Item selector**: clickable chips to pick which items to visualize, with select all / reset buttons
   - **Summary cards**: total sold, total revenue, unique items, days with sales, average revenue per day

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Create new user account |
| POST | `/api/signin` | Log in with email/password |
| GET | `/api/menu` | Get current menu (auto-detects reservation period) |
| GET | `/api/menu/:dato` | Get menu for specific date |
| GET | `/api/fooditems` | Get all active food items |
| GET | `/api/kategorier` | Get all food categories |
| POST | `/api/menu/tilfoej` | Add item to daily menu (admin) |
| DELETE | `/api/menu/:dailyMenuId` | Remove item from daily menu (admin) |
| POST | `/api/menu/discount` | Set discount quantity on menu item (admin) |
| POST | `/api/ordre` | Place an order |
| GET | `/api/ordrer/:userId` | Get user's order history |
| GET | `/api/ordrer/alle/:dato` | Get all orders for a date (admin) |
| POST | `/api/ordre/status` | Update order status (admin) |
| GET | `/api/stats/sales?from=&to=` | Get sales statistics for date range (admin) |

---

## How the Statistics Feature Works

1. **Frontend** (`main.js`): User clicks a period button (e.g. "1 uge"). `statsDateRange()` computes `from` and `to` dates. `loadStats()` fetches `/api/stats/sales?from=...&to=...`.

2. **Server** (`server.js`): Route extracts `from` and `to` query params, calls `servicelag.hentSalgsStatistik(from, to)`.

3. **Service layer** (`cantineServicelag.js`): Calls `datalag.hentSalgsStatistik()` to get raw order items, then aggregates them in JavaScript: groups by `food_item_id + menu_date`, sums `quantity` and `quantity * unit_price` to produce `total_sold` and `total_revenue` per item per day.

4. **Data layer** (`cantineDatalag.js`): Queries `order_items` with Supabase relation joins (`orders!inner`, `daily_menu!inner`, `food_items`, `food_categories`), filtering by date range and excluding cancelled orders.

5. **D3 rendering** (`main.js`): The aggregated data is used to build either a grouped bar chart or a line chart with `d3.scaleTime`, area fills, tooltips, and a color-coded legend.

---

## How to Run

```bash
npm install
node server.js
```

Open `http://localhost:3000` in a browser.

Requires a `.env` file with `SUPABASE_URL` and `SUPABASE_KEY`, and the SQL schema from `schema.sql` executed in the Supabase SQL Editor.

### Default Admin Login
- Email: `admin@bettercantine.dk`
- Password: `admin123`
