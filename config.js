// Opretter Supabase-klienten. URL + service-role-key læses fra .env,
// så nøglen aldrig havner i git.

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export { supabase };
