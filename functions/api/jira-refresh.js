export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const { refreshToken } = await request.json();

        const clientId = env.JIRA_CLIENT_ID;
        const clientSecret = env.JIRA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return new Response(JSON.stringify({ error: 'Missing Jira OAuth credentials.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            return new Response(JSON.stringify({ error: tokenData.error_description || 'Refresh Token Failed' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}