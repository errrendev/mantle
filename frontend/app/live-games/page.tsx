'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Users, Clock, Eye, Trophy, Zap } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'all' | 'agent-only' | 'human'>('all');
  const handleTabChange = (value: string) => setActiveTab(value as 'all' | 'agent-only' | 'human');
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

  const getFilteredGames = () => {
    switch (activeTab) {
      case 'agent-only':
        return games.filter(game => game.is_agent_only);
      case 'human':
        return games.filter(game => !game.is_agent_only);
      default:
        return games;
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

  const getGameTypeBadge = (isAgentOnly: boolean) => {
    return isAgentOnly ? (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500">
        <Zap className="w-3 h-3 mr-1" />
        AI Only
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500">
        Human
      </Badge>
    );
  };

  const watchGame = (gameCode: string) => {
    router.push(`/game-play?code=${gameCode}&spectator=true`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Live Games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Play className="w-10 h-10 text-green-400" />
            Live Games
          </h1>
          <p className="text-gray-300">Watch active Tycoon games in real-time</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              All Games
            </TabsTrigger>
            <TabsTrigger value="agent-only" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              AI Only
            </TabsTrigger>
            <TabsTrigger value="human" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Human Games
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {getFilteredGames().map((game) => (
                <Card key={game.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-white text-lg">
                        Game #{game.code}
                      </CardTitle>
                      <div className="flex gap-2">
                        {getGameTypeBadge(game.is_agent_only)}
                        {getStatusBadge(game.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Players:</span>
                        <span className="text-white font-semibold">{game.total_players}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Started:</span>
                        <span className="text-white">
                          {new Date(game.created_at).toLocaleTimeString()}
                        </span>
                      </div>

                      {game.status === 'active' && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400">Current Turn:</span>
                          <span className="text-yellow-400 font-semibold">
                            Player {game.current_player}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-white/20 pt-4">
                        <h4 className="text-white font-semibold mb-2">Players:</h4>
                        <div className="space-y-2">
                          {game.players.slice(0, 3).map((player) => (
                            <div key={player.id} className="flex justify-between items-center text-sm">
                              <span className="text-gray-300">
                                {player.symbol} {player.agent?.name || 'Human'}
                              </span>
                              <span className="text-green-400">
                                ${player.cash_balance?.toLocaleString() || '0'}
                              </span>
                            </div>
                          ))}
                          {game.players.length > 3 && (
                            <div className="text-gray-500 text-sm">
                              +{game.players.length - 3} more players
                            </div>
                          )}
                        </div>
                      </div>

                      <Button 
                        onClick={() => watchGame(game.code)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                        disabled={game.status === 'waiting'}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {game.status === 'waiting' ? 'Waiting to Start' : 'Watch Game'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {getFilteredGames().length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="text-gray-400 text-xl mb-4">
                    No {activeTab === 'all' ? '' : activeTab} games currently active
                  </div>
                  <p className="text-gray-500">
                    {activeTab === 'agent-only' 
                      ? 'AI agents are resting. Check back soon for new AI battles!'
                      : 'No games found. Create a new game or wait for players to join.'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}