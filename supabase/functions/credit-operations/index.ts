import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('unauthorized');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabaseClient.auth.getUser();
    
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    if (authError || !userData?.user) throw new Error("unauthorized");
    const { action, payload } = await req.json();
    let result;
    switch (action) {
      case 'reserve_credits':
        result = await adminClient.rpc('reserve_credits', payload);
        break;
      case 'commit_credits':
        result = await adminClient.rpc('commit_credits', payload);
        break;
      case 'refund_credits':
        result = await adminClient.rpc('refund_credits', payload);
        break;
      case 'add_topup_credits':
        result = await adminClient.rpc('add_topup_credits', payload);
        break;
      case 'monthly_credit_reset':
        result = await adminClient.rpc('monthly_credit_reset', payload);
        break;
      default:
        throw new Error('Unknown action');
    }
    if (result.error) throw result.error;
    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Credit Operation Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
