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
    const { data: registers, error: regError } = await supabase.from('cash_registers').select('*').eq('status', 'Aberto');
    console.log('Open Registers Error:', regError);
    console.log('Open Registers:', registers);

    const { data: txs, error: txError } = await supabase.from('cash_transactions').select('*');
    console.log('Cash TXs Error:', txError);
    console.log('Cash TXs count:', txs?.length);
    if (txs?.length > 0) console.log('Last TX:', txs[txs.length - 1]);
}
check();
