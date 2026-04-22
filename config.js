// denne fil sætter klient-objekt op -
// forbindelse til supabase-tjenesten
// anvender adresse til supa-projekt
// samt hemmelig nøgle dertil, placeret i .env-fil

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export { supabase };

// anvendes i datalag-funktioner som taler med Supabase-databasen
