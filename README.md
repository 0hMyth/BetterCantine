# BetterCantine

Kantinebestillings-app bygget med Node.js, Express og Supabase.
Følger 3-lags-arkitekturen (præsentationslag, servicelag, datalag).

## Filer og 3-lags-struktur

```
BetterCantine/
  config.js              - Supabase-forbindelse (.env)
  cantineDatalag.js      - DATALAG: alle Supabase-kald
  cantineServicelag.js   - SERVICELAG: forretningslogik
  server.js              - PRÆSENTATIONSLAG: Express routing
  public/
    index.html           - PRÆSENTATIONSLAG: HTML + CSS
    main.js              - PRÆSENTATIONSLAG: klient-JavaScript
  package.json
  .env.example
```

## Opsætning trin for trin

### 1. Supabase-projekt

1. Gå til supabase.com og opret et nyt projekt
2. Gå til SQL Editor i Supabase Dashboard
3. Kopiér og kør hele SQL-koden fra schema.sql (den du allerede har)
4. Gå til Settings - API og kopiér URL + anon key

### 2. Admin-konto

Admin-kontoen oprettes automatisk af schema.sql:
- Email: admin@bettercantine.dk
- Password: admin123

Du kan ændre det direkte i SQL-filen før du kører den.

### 3. Konfigurer projektet lokalt

```bash
cd BetterCantine
cp .env.example .env
```

Rediger .env og indsæt dine Supabase-værdier:
```
SUPABASE_URL=https://dit-projekt.supabase.co
SUPABASE_KEY=din-service-role-key
```

VIGTIGT: Brug service_role key (ikke anon key) - find den under
Settings - API - service_role. Den giver fuld adgang uden RLS.

### 4. Installer og kør

```bash
npm install
npm start
```

Åben http://localhost:3000 i browseren.

## Brug

### Som elev (student)
- Opret konto med email + password + navn
- Se dagens menu og tilføj varer til kurven
- Betal og få en kvitteringskode (fx BC-A3F9K2)
- Vis koden i kantinen og hent maden
- Før kl. 08:00 = reservation, efter = direkte køb

### Som admin (kantinedame)
- Log ind med admin-kontoen
- Administrer menu: tilføj food items med antal til en dato
- Se alle ordrer og marker dem som afhentet
- Sæt rabat: vælg hvor mange af hver vare der er til rabatpris
