import express from 'express';
const app = express();
const port = process.env.PORT || 3000;
import servicelag from './cantineServicelag.js';

app.use(express.static('public'));
app.use(express.json());

// AUTH ROUTES
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;
        const result = await servicelag.signUp(email, password, fullName);
        if (result.error) return res.status(400).json({ error: result.error.message });
        res.json(result.data);
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.post('/api/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await servicelag.signIn(email, password);
        if (result.error) return res.status(400).json({ error: result.error.message });
        res.json(result.data);
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

// MENU ROUTES
app.get('/api/menu', async (req, res) => {
    try { res.json(await servicelag.hentMenu()); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.get('/api/menu/:dato', async (req, res) => {
    try { res.json(await servicelag.hentMenuForDato(req.params.dato)); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.get('/api/fooditems', async (req, res) => {
    try { res.json(await servicelag.hentAlleFoodItems()); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.get('/api/kategorier', async (req, res) => {
    try { res.json(await servicelag.hentKategorier()); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.post('/api/menu/tilfoej', async (req, res) => {
    try {
        const { foodItemId, menuDate, totalQuantity } = req.body;
        res.json(await servicelag.tilføjTilDagensMenu(foodItemId, menuDate, totalQuantity));
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.delete('/api/menu/:dailyMenuId', async (req, res) => {
    try { res.json(await servicelag.fjernFraDagensMenu(req.params.dailyMenuId)); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.post('/api/menu/discount', async (req, res) => {
    try {
        const { dailyMenuId, discountedQuantity } = req.body;
        const result = await servicelag.opdaterDiscount(dailyMenuId, discountedQuantity);
        if (result && result.error) return res.status(400).json({ error: result.error });
        res.json(result);
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

// ORDRE ROUTES
app.post('/api/ordre', async (req, res) => {
    try {
        const { userId, items, isReservation } = req.body;
        const result = await servicelag.opretOrdre(userId, items, isReservation);
        if (result.error) return res.status(400).json({ error: result.error.message });
        res.json(result.data);
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.get('/api/ordrer/:userId', async (req, res) => {
    try { res.json(await servicelag.hentMineOrdrer(req.params.userId)); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.get('/api/ordrer/alle/:dato', async (req, res) => {
    try { res.json(await servicelag.hentAlleOrdrer(req.params.dato)); }
    catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

app.post('/api/ordre/status', async (req, res) => {
    try {
        const { ordreId, nyStatus } = req.body;
        res.json(await servicelag.opdaterOrdreStatus(ordreId, nyStatus));
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

// STATISTIK ROUTES
app.get('/api/stats/sales', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Mangler from og to parametre' });
        res.json(await servicelag.hentSalgsStatistik(from, to));
    } catch (err) { console.log(err); res.status(500).json({ error: 'Server fejl' }); }
});

// Auto-cancel unpicked orders when canteen closes (13:45)
let lastCancelDate = null;
setInterval(async () => {
    if (!servicelag.erKantinenAaben() && servicelag.erReservationsperiode()) {
        const dato = servicelag.getDatoIdag();
        if (lastCancelDate !== dato) {
            lastCancelDate = dato;
            await servicelag.annullerIkkeAfhentedeOrdrer();
        }
    }
}, 60 * 1000);

app.listen(port, () => { console.log('BetterCantine kører på port ' + port); });
