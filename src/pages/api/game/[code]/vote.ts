import type { APIRoute } from 'astro';
import { getGameStore } from '../../../../lib/store';

export const POST: APIRoute = async ({ request, params, cookies, locals }) => {
  const code = params.code;
  if (!code) return new Response(null, { status: 404 });

  const playerId = cookies.get('imposter_id')?.value;
  if (!playerId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // @ts-ignore
  const env = locals.runtime?.env;
  const store = getGameStore(env);

  try {
    const body = await request.json();
    let targetId = body.targetId;
    const targetName = body.targetName;

    if (!targetId && targetName) {
      // Find player by name
      const game = await store.getGame(code);
      const targetPlayer = game?.players.find(p => p.name === targetName);
      if (targetPlayer) {
        targetId = targetPlayer.id;
      }
    }
    
    const success = await store.voteOut(code, playerId, targetId);

    if (success) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: 'Could not vote out player' }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
};
