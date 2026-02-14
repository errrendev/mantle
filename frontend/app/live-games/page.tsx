'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Game {
  id: number;
  code: string;
  status: 'waiting' | 'active' | 'completed';
  is_agent_only: boolean;
  current_player?: number;
  total_players: number;
  created_at: string;
  updated_at: string;
  players: GamePlayer[];
}

interface GamePlayer {
  id: number;
  game_id: number;
  user_address?: string;
  agent_id?: number;
  agent?: Agent;
  symbol: string;
  turn_order: number;
  is_bankrupt: boolean;
  is_ai: boolean;
  current_position: number;
  cash_balance: number;
}

interface Agent {
  id: number;
  name: string;
  strategy: string;
  risk_profile: string;
  total_wins: number;
  total_matches: number;
}

export default function LiveGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchLiveGames();
    const interval = setInterval(fetchLiveGames, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchLiveGames = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/games/active`);
      const data = await response.json();

      if (data.success) {
        setGames(data.data);
      }
    } catch (error) {
      console.error('Error fetching live games:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500">Waiting</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500">Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const watchGame = (gameCode: string) => {
    router.push(`/ai-play?gameCode=${gameCode}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[url('/grid-pattern.svg')] bg-fixed bg-cover bg-no-repeat bg-[#0a001a] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-bold animate-pulse">Loading Live Battles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/grid-pattern.svg')] bg-fixed bg-cover bg-no-repeat bg-[#0a001a]">
      {/* Top Neon Glow Bar */}
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80 z-50" />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 mb-4 flex items-center justify-center gap-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <Play className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            LIVE BATTLES
          </h1>
          <p className="text-purple-200/70 text-lg font-medium tracking-wide">
            Watch AI Agents compete for dominance in real-time
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Card key={game.id} className="bg-[#13082a]/80 backdrop-blur-xl border border-purple-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300 group overflow-hidden">
              {/* Card Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <CardHeader className="pb-4 border-b border-purple-500/20 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-xl font-bold tracking-tight group-hover:text-cyan-300 transition-colors">
                      GAME #{game.code}
                    </CardTitle>
                    <div className="text-xs text-purple-400 mt-1 font-mono">
                      {new Date(game.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(game.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 relative z-10">
                <div className="space-y-6">
                  {/* Game Stats Row */}
                  <div className="flex justify-between items-stretch gap-4">
                    <div className="bg-[#0a0510]/60 rounded-lg p-3 flex-1 text-center border border-purple-500/20">
                      <span className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Players</span>
                      <span className="text-white font-bold text-xl">{game.total_players}</span>
                    </div>
                    {game.status === 'active' && (
                      <div className="bg-[#0a0510]/60 rounded-lg p-3 flex-1 text-center border border-purple-500/20">
                        <span className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Turn</span>
                        <span className="text-yellow-400 font-bold text-xl">
                          P{game.current_player}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Players List */}
                  <div className="space-y-3">
                    <h4 className="text-purple-300 font-semibold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                      Active Agents
                    </h4>
                    <div className="space-y-2">
                      {game.players.slice(0, 3).map((player) => (
                        <div key={player.id} className="flex justify-between items-center text-sm p-2 rounded bg-purple-900/10 border border-purple-500/10">
                          <span className="text-gray-200 font-medium flex items-center gap-2">
                            <span className="text-lg">{player.symbol}</span>
                            {player.agent?.name ? (
                              <span className="text-cyan-100">{player.agent.name.split('_')[0]}</span>
                            ) : 'Human'}
                          </span>
                          <span className="text-green-400 font-mono font-bold">
                            ${player.cash_balance?.toLocaleString() || '0'}
                          </span>
                        </div>
                      ))}
                      {game.players.length > 3 && (
                        <div className="text-center text-xs text-purple-400/60 font-medium mt-1">
                          +{game.players.length - 3} more contenders
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => watchGame(game.code)}
                    className={`w-full font-bold tracking-wide py-6 shadow-lg transition-all duration-300
                      ${game.status === 'waiting'
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/40 border border-purple-400/30'
                      }`}
                    disabled={game.status === 'waiting'}
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    {game.status === 'waiting' ? 'WAITING TO START' : 'SPECTATE LIVE'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {games.length === 0 && (
            <div className="col-span-full text-center py-20">
              <div className="inline-block p-6 rounded-full bg-purple-900/20 mb-6 border border-purple-500/30">
                <Play className="w-12 h-12 text-purple-400/50" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">The Arena is Quiet</h3>
              <p className="text-purple-300/60 max-w-md mx-auto">
                All agents are currently resting. Check back soon for the next high-stakes battle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}