import type { APIRoute } from 'astro';
import { getGameStore } from '../../../../lib/store';
import type { PublicGameState } from '../../../../lib/types';

export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const code = params.code;
  if (!code) return new Response(null, { status: 404 });

  const playerId = cookies.get('imposter_id')?.value;
  if (!playerId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // @ts-ignore
  const env = locals.runtime?.env;
  const store = getGameStore(env);
  
  const result = await store.startGame(code, playerId);

  // Check if result is an error
  if ('error' in result) {
    return new Response(JSON.stringify({ error: result.error }), { status: result.status });
  }

  const updatedGame = result;
  // Construct public state (Optimized to avoid extra poll)
  const myPlayer = updatedGame.players.find(p => p.id === playerId);
  const publicState: PublicGameState = {
    code: updatedGame.code,
    status: updatedGame.status,
    config: updatedGame.config,
    category: updatedGame.category,
    players: updatedGame.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      votedOut: !!p.votedOut,
      isMe: p.id === playerId,
      role: (p.votedOut || updatedGame.status === 'finished' || p.id === playerId) ? p.role : undefined
    })),
    myPlayer: myPlayer ? { ...myPlayer } : undefined,
    nextGameCode: updatedGame.nextGameCode,
    starterId: updatedGame.starterId
  };

  return new Response(JSON.stringify(publicState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
  });
};
