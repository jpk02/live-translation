export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await request.json();
  } catch(e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }

  const { email, name, church_id } = body;
  if (!email || !name || !church_id) {
    return new Response(JSON.stringify({ error: 'Missing email, name, or church_id' }), { status: 400, headers: corsHeaders });
  }

  // 1. Invite user via Supabase admin API
  const inviteRes = await fetch(
    'https://zhrkwgpjvgessiqmmefn.supabase.co/auth/v1/admin/invite',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ email, data: { full_name: name } })
    }
  );

  const inviteData = await inviteRes.json();

  if (!inviteRes.ok) {
    return new Response(JSON.stringify({ error: inviteData.msg || inviteData.message || 'Invite failed' }), { status: 400, headers: corsHeaders });
  }

  const userId = inviteData.id;

  // 2. Create profile for invited user
  const profileRes = await fetch(
    'https://zhrkwgpjvgessiqmmefn.supabase.co/rest/v1/profiles',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id: userId,
        church_id: church_id,
        role: 'member',
        full_name: name,
        email: email
      })
    }
  );

  if (!profileRes.ok) {
    const profileErr = await profileRes.text();
    return new Response(JSON.stringify({ error: 'Profile creation failed: ' + profileErr }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
