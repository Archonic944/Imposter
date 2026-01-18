import type { APIRoute } from 'astro';
import { getGameStore } from '../../../lib/store';
import type { GameConfig } from '../../../lib/types';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const body = await request.json();
    const config: GameConfig = body.config;

    let hostId = cookies.get('imposter_id')?.value;
    if (!hostId) {
      hostId = crypto.randomUUID();
      cookies.set('imposter_id', hostId, { path: '/', maxAge: 60 * 60 * 24 });
    }

    // @ts-ignore
    const env = locals.runtime?.env;
    const store = getGameStore(env);
    const code = await store.createGame(hostId, config);

    return new Response(JSON.stringify({ code }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
};
