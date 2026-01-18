import type { APIRoute } from 'astro';
import { getGameStore } from '../../../../lib/store';

export const POST: APIRoute = async ({ request, params, cookies, locals }) => {
  const code = params.code;
  if (!code) return new Response(null, { status: 404 });

  try {
    const body = await request.json();
    const name = body.name;

    let playerId = cookies.get('imposter_id')?.value;
    if (!playerId) {
      playerId = crypto.randomUUID();
      cookies.set('imposter_id', playerId, { path: '/', maxAge: 60 * 60 * 24 });
    }

    // @ts-ignore
    const env = locals.runtime?.env;
    const store = getGameStore(env);
    const success = await store.joinGame(code, playerId, name);

    if (success) {
      return new Response(JSON.stringify({ success: true, playerId }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: 'Could not join game' }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
};
