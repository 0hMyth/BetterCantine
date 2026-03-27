# BetterCantine

Kantinebestillings-app bygget med Node.js, Express og Supabase.
Foelger 3-lags-arkitekturen (praesentationslag, servicelag, datalag).

## Filer og 3-lags-struktur

```
BetterCantine/
  config.js              - Supabase-forbindelse (.env)
  cantineDatalag.js      - DATALAG: alle Supabase-kald
  cantineServicelag.js   - SERVICELAG: forretningslogik
  server.js              - PRAESENTATIONSLAG: Express routing
  public/
    index.html           - PRAESENTATIONSLAG: HTML + CSS
    main.js              - PRAESENTATIONSLAG: klient-JavaScript
  package.json
  .env.example
```

## Opsaetning trin for trin

### 1. Supabase-projekt

1. Gaa til supabase.com og opret et nyt projekt
2. Gaa til SQL Editor i Supabase Dashboard
3. Kopiér og koer hele SQL-koden fra schema.sql (den du allerede har)
4. Gaa til Settings - API og kopiér URL + anon key

### 2. Admin-konto

Admin-kontoen oprettes automatisk af schema.sql:
- Email: admin@bettercantine.dk
- Password: admin123

Du kan aendre det direkte i SQL-filen foer du koerer den.

### 3. Konfigurer projektet lokalt

```bash
cd BetterCantine
cp .env.example .env
```

Rediger .env og indsaet dine Supabase-vaerdier:
```
SUPABASE_URL=https://dit-projekt.supabase.co
SUPABASE_KEY=din-service-role-key
```

VIGTIGT: Brug service_role key (ikke anon key) - find den under
Settings - API - service_role. Den giver fuld adgang uden RLS.

### 4. Installer og koer

```bash
npm install
npm start
```

Aaben http://localhost:3000 i browseren.

## Brug

### Som elev (student)
- Opret konto med email + password + navn
- Se dagens menu og tilfoej varer til kurven
- Betal og faa en kvitteringskode (fx BC-A3F9K2)
- Vis koden i kantinen og hent maden
- Foer kl. 08:00 = reservation, efter = direkte koeb

### Som admin (kantinedame)
- Log ind med admin-kontoen
- Administrer menu: tilfoej food items med antal til en dato
- Se alle ordrer og marker dem som afhentet
- Saet rabat: vaelg hvor mange af hver vare der er til rabatpris
