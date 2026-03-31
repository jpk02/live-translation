export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    if (!env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_KEY not configured' }), { status: 500, headers: corsHeaders });
    }
    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    let body;
    try { body = await request.json(); } catch(e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
    }

    const { email, name, church_id, church_name } = body;
    if (!email || !name || !church_id) {
      return new Response(JSON.stringify({ error: 'Missing email, name, or church_id' }), { status: 400, headers: corsHeaders });
    }

    // 1. Create user in Supabase (no invite email)
    const createRes = await fetch(
      'https://zhrkwgpjvgessiqmmefn.supabase.co/auth/v1/admin/users',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({
          email,
          email_confirm: true,
          user_metadata: { full_name: name }
        })
      }
    );

    const createText = await createRes.text();
    let userData;
    try { userData = JSON.parse(createText); } catch(e) {
      return new Response(JSON.stringify({ error: 'Supabase error: ' + createText.substring(0, 200) }), { status: 400, headers: corsHeaders });
    }

    if (!createRes.ok) {
      return new Response(JSON.stringify({ error: userData.msg || userData.message || JSON.stringify(userData) }), { status: 400, headers: corsHeaders });
    }

    const userId = userData.id;

    // 2. Generate password reset link for them to set their password
    const linkRes = await fetch(
      'https://zhrkwgpjvgessiqmmefn.supabase.co/auth/v1/admin/users/' + userId + '/links',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ type: 'recovery' })
      }
    );

    const linkText = await linkRes.text();
    let linkData;
    try { linkData = JSON.parse(linkText); } catch(e) {
      linkData = {};
    }

    const resetLink = linkData.action_link || 'https://live-translation-3bm.pages.dev/login.html';

    // 3. Create profile
    await fetch(
      'https://zhrkwgpjvgessiqmmefn.supabase.co/rest/v1/profiles',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ id: userId, church_id, role: 'member', full_name: name, email })
      }
    );

    // 4. Send invite email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Live Translation <onboarding@resend.dev>',
        to: [email],
        subject: "You've been invited to " + (church_name || 'your church') + " on Live Translation",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 20px">
            <h2 style="font-size:22px;margin-bottom:8px">You've been invited</h2>
            <p style="color:#555;margin-bottom:24px">
              Hi ${name}, you've been added to <strong>${church_name || 'your church'}</strong> on Live Translation.
              Click the button below to set your password and get started.
            </p>
            <a href="${resetLink}" style="display:inline-block;background:#1a1714;color:white;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:500">
              Set your password
            </a>
            <p style="color:#aaa;font-size:12px;margin-top:32px">
              If you weren't expecting this invite, you can ignore this email.
            </p>
          </div>
        `
      })
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: 'Email failed: ' + JSON.stringify(emailData) }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });

  } catch(e) {
    return new Response(JSON.stringify({ error: 'Function error: ' + e.message }), { status: 500, headers: corsHeaders });
  }
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
