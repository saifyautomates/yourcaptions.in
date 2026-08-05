import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { url, method } = req;
  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, payload } = await req.json();

    let result;
    switch (action) {
      case 'reserve_credits':
        result = await supabaseClient.rpc('reserve_credits', payload);
        break;
      case 'commit_credits':
        result = await supabaseClient.rpc('commit_credits', payload);
        break;
      case 'refund_credits':
        result = await supabaseClient.rpc('refund_credits', payload);
        break;
      case 'add_topup_credits':
        result = await supabaseClient.rpc('add_topup_credits', payload);
        break;
      case 'admin_adjust_credits':
        result = await supabaseClient.rpc('admin_adjust_credits', payload);
        break;
      case 'monthly_credit_reset':
        result = await supabaseClient.rpc('monthly_credit_reset', payload);
        break;
      default:
        throw new Error('Unknown action');
    }

    if (result.error) throw result.error;

    return new Response(JSON.stringify({ data: result.data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Credit Operation Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
