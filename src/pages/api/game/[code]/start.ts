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
  
  const gameBefore = await store.getGame(code);
  if (!gameBefore) return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
  if (gameBefore.hostId !== playerId) return new Response(JSON.stringify({ error: 'Only host can start' }), { status: 403 });
  if (gameBefore.players.length < 2) return new Response(JSON.stringify({ error: 'Need at least 2 players' }), { status: 400 });

  const updatedGame = await store.startGame(code, playerId);

  if (updatedGame) {
    // Construct public state (Optimized to avoid extra poll)
    const myPlayer = updatedGame.players.find(p => p.id === playerId);
    const publicState: PublicGameState = {
      code: updatedGame.code,
      status: updatedGame.status,
      config: updatedGame.config,
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
  } else {
    return new Response(JSON.stringify({ error: 'Could not start game' }), { status: 400 });
  }
};
