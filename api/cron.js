import servicelag from '../cantineServicelag.js';

// Kaldes af Vercel Cron hvert minut. Samme logik som setInterval i server.js:
// når kantinen lige er lukket, annulleres betalte ordrer som ikke er afhentet.
// I serverless-miljøet kan vi ikke holde lastCancelDate i memory mellem kald,
// men datalag.annullerIkkeAfhentedeOrdrer er idempotent — den tager kun ordrer
// der stadig har status 'paid', så dobbeltkald samme dag gør ingen skade.
export default async function handler(req, res) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        if (!servicelag.erKantinenAaben() && servicelag.erReservationsperiode()) {
            const result = await servicelag.annullerIkkeAfhentedeOrdrer();
            return res.status(200).json({
                ok: true,
                ran: new Date().toISOString(),
                cancelled: result ? result.length : 0
            });
        }
        return res.status(200).json({ ok: true, ran: new Date().toISOString(), skipped: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Cron fejl' });
    }
}
