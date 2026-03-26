const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client (bypasses RLS - use only when necessary)
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

// Client for isolated requests (respects RLS based on user token)
const getSupabaseClient = (token) => {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
};

module.exports = { supabaseAdmin, getSupabaseClient };
