import type { APIRoute } from 'astro';
import { getGameStore } from '../../../../lib/store';
import type { PublicGameState } from '../../../../lib/types';

export const GET: APIRoute = async ({ params, cookies, locals }) => {
  const code = params.code;
  if (!code) return new Response(null, { status: 404 });

  // @ts-ignore
  const env = locals.runtime?.env;
  const store = getGameStore(env);
  const game = await store.getGame(code);
  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
  }

  const playerId = cookies.get('imposter_id')?.value || '';
  const myPlayer = game.players.find(p => p.id === playerId);
  
  // Construct public state
  const publicState: PublicGameState = {
    code: game.code,
    status: game.status,
    config: game.config,
    players: game.players.map(p => ({
      id: p.id, // Expose ID for starter check (safe-ish, but maybe hash it if super strict? Nah, party game)
      name: p.name,
      isHost: p.isHost,
      votedOut: !!p.votedOut,
      isMe: p.id === playerId,
      role: (p.votedOut || game.status === 'finished' || p.id === playerId) ? p.role : undefined
    })),
    myPlayer: myPlayer ? {
      ...myPlayer,
    } : undefined,
    nextGameCode: game.nextGameCode,
    starterId: game.starterId
  };

  // If game is finished, maybe reveal everything?
  if (game.status === 'finished') {
    // Add logic to reveal imposter globally if needed, 
    // but the UI can just show it if we add an 'imposterName' field to public state
  }

  return new Response(JSON.stringify(publicState), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
