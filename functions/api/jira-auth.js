export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const { code, redirectUri } = await request.json();

        const clientId = env.JIRA_CLIENT_ID;
        const clientSecret = env.JIRA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return new Response(JSON.stringify({ error: 'Missing Jira OAuth credentials in Cloudflare Environment.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            return new Response(JSON.stringify({ error: tokenData.error_description || 'Token Exchange Failed' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const resourcesData = await resourcesRes.json();
        const cloudId = resourcesData && resourcesData.length > 0 ? resourcesData[0].id : null;

        return new Response(JSON.stringify({
            access_token: tokenData.access_token,
            cloud_id: cloudId
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