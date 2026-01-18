import type { APIRoute } from 'astro';
import { getGameStore } from '../../../../lib/store';

export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const code = params.code;
  if (!code) return new Response(null, { status: 404 });

  const playerId = cookies.get('imposter_id')?.value;
  if (!playerId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // @ts-ignore
  const env = locals.runtime?.env;
  const store = getGameStore(env);
  
  const game = await store.getGame(code);
  if (!game) return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
  if (game.hostId !== playerId) return new Response(JSON.stringify({ error: 'Only host can replay' }), { status: 403 });

  try {
    // Create new game with same config
    const newCode = await store.createGame(playerId, game.config);
    
    // Link old game to new game
    game.nextGameCode = newCode;
    await store.saveGame(game);

    return new Response(JSON.stringify({ newCode }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to create replay game' }), { status: 500 });
  }
};
