const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: order } = await supabase.from('orders').select('id, payment_method').limit(1).single();
    if (order) {
        console.log("Trying to update order:", order.id);
        const { error } = await supabase.from('orders').update({ payment_method: 'Misto' }).eq('id', order.id);
        console.log("Error updating to 'Misto':", error);
    }
}
check();
