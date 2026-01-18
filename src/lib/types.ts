export type Player = {
  id: string; // Cookie or local storage ID
  name: string;
  isHost: boolean;
  role?: 'imposter' | 'civilian';
  word?: string;
  hint?: string;
  votedOut?: boolean;
};

export type GameConfig = {
  categories: string[];
  hintsEnabled: boolean;
};

export type GameState = {
  code: string;
  hostId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  config: GameConfig;
  currentWord: string; // The secret word
  imposterId: string; // The secret imposter
  category: string; // The chosen category
  createdAt: number;
  nextGameCode?: string; // Link to the next game (replay)
  starterId?: string; // Who starts the round
};

export type PublicGameState = {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  players: {
    name: string;
    isHost: boolean;
    votedOut: boolean;
    isMe: boolean; // Computed for the requester
    role?: string; // Revealed if voted out or game over
    id: string; // Needed for identifying starter
  }[];
  myPlayer?: Player; // Detailed info for the requester
  config: GameConfig;
  nextGameCode?: string;
  starterId?: string;
};
