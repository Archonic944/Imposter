import type { GameState, GameConfig, Player } from './types';
import categoriesData from '../data/categories.json';

// In-memory fallback for development (or when D1 is missing)
const globalGames = new Map<string, GameState>();

export class GameStore {
  private env: any;

  constructor(env?: any) {
    this.env = env;
  }

  // Helper to get DB connection if available
  private get db() {
    return this.env?.DB;
  }

  async createGame(hostId: string, config: GameConfig): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const game: GameState = {
      code,
      hostId,
      players: [],
      status: 'lobby',
      config,
      currentWord: '',
      imposterId: '',
      category: '',
      createdAt: Date.now()
    };

    if (this.db) {
       try {
         // Lazy Schema Migration & Init
         // We try to create table with new schema. If it exists, this is ignored.
         await this.db.prepare('CREATE TABLE IF NOT EXISTS games (code TEXT PRIMARY KEY, data TEXT, created_at INTEGER)').run();
         
         // Attempt to add column if it was created with old schema (lazy migration)
         try {
            await this.db.prepare('ALTER TABLE games ADD COLUMN created_at INTEGER').run();
         } catch (e) {
            // Column likely exists or other non-fatal error
         }

         // CLEANUP: Delete games older than 3 hours
         const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
         await this.db.prepare('DELETE FROM games WHERE created_at < ?').bind(threeHoursAgo).run();

         // Insert new game
         await this.db.prepare('INSERT INTO games (code, data, created_at) VALUES (?, ?, ?)').bind(code, JSON.stringify(game), Date.now()).run();
       } catch (e) {
         console.error('D1 Create Error:', e);
         throw new Error('Failed to create game in database');
       }
    } else {
      // In-memory cleanup
      const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
      for (const [key, g] of globalGames.entries()) {
        if (g.createdAt < threeHoursAgo) {
          globalGames.delete(key);
        }
      }
      globalGames.set(code, game);
    }
    
    return code;
  }

  async getGame(code: string): Promise<GameState | null> {
    if (this.db) {
      try {
        const res = await this.db.prepare('SELECT data FROM games WHERE code = ?').bind(code).first();
        if (res && res.data) {
          return JSON.parse(res.data as string);
        }
        return null; // Not found in DB
      } catch (e) {
        console.error('D1 Read Error:', e);
        return null;
      }
    }
    return globalGames.get(code) || null;
  }

  async saveGame(game: GameState) {
    if (this.db) {
      try {
        // Update created_at to keep the game "alive" (resetting the 3h timer)
        await this.db.prepare('UPDATE games SET data = ?, created_at = ? WHERE code = ?').bind(JSON.stringify(game), Date.now(), game.code).run();
      } catch (e) {
         console.error('D1 Save Error:', e);
         throw new Error('Failed to save game state');
      }
    } else {
      globalGames.set(game.code, game);
    }
  }

  async joinGame(code: string, playerId: string, name: string): Promise<boolean> {
    const game = await this.getGame(code);
    if (!game) return false;

    // Check if name is taken by another player
    const nameTaken = game.players.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== playerId);
    if (nameTaken) return false;

    // Check if player already exists (reconnect)
    const existing = game.players.find(p => p.id === playerId);
    if (existing) {
      existing.name = name; // Update name
      await this.saveGame(game);
      return true;
    }

    if (game.status !== 'lobby') {
       return false;
    }

    const isHostUser = game.hostId === playerId;

    game.players.push({
      id: playerId,
      name,
      isHost: isHostUser,
      votedOut: false
    });

    await this.saveGame(game);
    return true;
  }

  async startGame(code: string, hostId: string): Promise<GameState | { error: string; status: number }> {
    const game = await this.getGame(code);
    if (!game) return { error: 'Game not found', status: 404 };
    if (game.hostId !== hostId) return { error: 'Only host can start', status: 403 };
    if (game.status !== 'lobby') return { error: 'Game already started', status: 400 };
    // Allow 2 players for testing, though 3 is better for gameplay
    if (game.players.length < 2) return { error: 'Need at least 2 players', status: 400 }; 

    // 1. Pick Category
    const categoryKeys = game.config.categories.length > 0 
      ? game.config.categories 
      : Object.keys(categoriesData);
    
    const randomCatKey = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const words = (categoriesData as any)[randomCatKey];
    const randomEntry = words[Math.floor(Math.random() * words.length)];
    const randomWord = randomEntry.word;
    const randomHint = randomEntry.hint;
    
    // 2. Pick Imposter
    const imposterIndex = Math.floor(Math.random() * game.players.length);
    const imposterId = game.players[imposterIndex].id;

    // 3. Pick Starter (Random)
    const starterIndex = Math.floor(Math.random() * game.players.length);
    const starterId = game.players[starterIndex].id;

    // 4. Assign Roles
    game.players.forEach(p => {
      if (p.id === imposterId) {
        p.role = 'imposter';
        if (game.config.hintsEnabled) {
             p.hint = randomHint;
        } else {
             p.hint = '';
        }
      } else {
        p.role = 'civilian';
        p.word = randomWord;
      }
    });

    game.category = randomCatKey;
    game.currentWord = randomWord;
    game.imposterId = imposterId;
    game.starterId = starterId;
    game.status = 'playing';
    game.startedAt = Date.now();

    await this.saveGame(game);
    return game;
  }

  async voteOut(code: string, hostId: string, targetId: string): Promise<boolean> {
    const game = await this.getGame(code);
    if (!game) return false;
    if (game.hostId !== hostId) return false;

    const target = game.players.find(p => p.id === targetId);
    if (target) {
      target.votedOut = true;
      await this.saveGame(game);
      return true;
    }
    return false;
  }
}

// Factory to get store with environment
export const getGameStore = (env?: any) => new GameStore(env);

