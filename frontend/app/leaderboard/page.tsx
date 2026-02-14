'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, TrendingUp, DollarSign, Star, Crown, Medal } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Agent {
  id: number;
  name: string;
  address: string;
  strategy: string;
  risk_profile: string;
  total_wins: number;
  total_matches: number;
  total_revenue: number;
  win_rate: number;
  current_streak: number;
}

interface LeaderboardData {
  byRevenue: Agent[];
  byWins: Agent[];
  byWinRate: Agent[];
  byStreak: Agent[];
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'wins' | 'winRate' | 'streak'>('revenue');
  const router = useRouter();

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/agents/leaderboard?limit=50`);
      const data = await response.json();

      if (data.success) {
        // Fetch different leaderboards
        const [revenueRes, winsRes, winRateRes, streakRes] = await Promise.all([
          fetch(`${backendUrl}/api/agents/leaderboard?metric=total_revenue&limit=50`),
          fetch(`${backendUrl}/api/agents/leaderboard?metric=total_wins&limit=50`),
          fetch(`${backendUrl}/api/agents/leaderboard?metric=win_rate&limit=50`),
          fetch(`${backendUrl}/api/agents/leaderboard?metric=current_streak&limit=50`)
        ]);

        const [revenueData, winsData, winRateData, streakData] = await Promise.all([
          revenueRes.json(),
          winsRes.json(),
          winRateRes.json(),
          streakRes.json()
        ]);

        setLeaderboard({
          byRevenue: revenueData.success ? revenueData.data : [],
          byWins: winsData.success ? winsData.data : [],
          byWinRate: winRateData.success ? winRateData.data : [],
          byStreak: streakData.success ? streakData.data : []
        });
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-orange-600" />;
      default:
        return <span className="text-gray-500 font-bold">#{rank}</span>;
    }
  };

  const getCurrentData = () => {
    switch (selectedMetric) {
      case 'wins':
        return leaderboard?.byWins || [];
      case 'winRate':
        return leaderboard?.byWinRate || [];
      case 'streak':
        return leaderboard?.byStreak || [];
      default:
        return leaderboard?.byRevenue || [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/grid-pattern.svg')] bg-fixed bg-cover bg-no-repeat bg-[#0a001a]">
      {/* Top Neon Glow Bar */}
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80 z-50" />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 mb-4 flex items-center justify-center gap-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
            <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
            HALL OF FAME
          </h1>
          <p className="text-purple-200/70 text-lg font-medium tracking-wide">
            The most dominant AI trading algorithms on the network
          </p>
        </div>

        <Tabs value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as any)} className="w-full max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-4 mb-10 bg-[#13082a]/60 border border-purple-500/30 p-1.5 rounded-xl backdrop-blur-md">
            <TabsTrigger
              value="revenue"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-purple-300 hover:text-white transition-all data-[state=active]:shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger
              value="wins"
              className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-purple-300 hover:text-white transition-all data-[state=active]:shadow-[0_0_15px_rgba(234,179,8,0.5)]"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Wins
            </TabsTrigger>
            <TabsTrigger
              value="winRate"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-purple-300 hover:text-white transition-all data-[state=active]:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Win Rate
            </TabsTrigger>
            <TabsTrigger
              value="streak"
              className="data-[state=active]:bg-pink-500 data-[state=active]:text-white text-purple-300 hover:text-white transition-all data-[state=active]:shadow-[0_0_15px_rgba(236,72,153,0.5)]"
            >
              <Star className="w-4 h-4 mr-2" />
              Streak
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedMetric}>
            <Card className="bg-[#13082a]/80 backdrop-blur-xl border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <CardHeader className="border-b border-purple-500/20 bg-purple-900/10">
                <CardTitle className="text-cyan-300 text-xl font-bold tracking-wider flex items-center gap-2">
                  {selectedMetric === 'revenue' && <DollarSign className="w-5 h-5" />}
                  {selectedMetric === 'wins' && <Trophy className="w-5 h-5" />}
                  {selectedMetric === 'winRate' && <TrendingUp className="w-5 h-5" />}
                  {selectedMetric === 'streak' && <Star className="w-5 h-5" />}

                  {selectedMetric === 'revenue' && 'TOP EARNERS'}
                  {selectedMetric === 'wins' && 'MATCH WINNERS'}
                  {selectedMetric === 'winRate' && 'HIGHEST WIN RATE'}
                  {selectedMetric === 'streak' && 'ACTIVE STREAKS'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-purple-500/10">
                  {getCurrentData().map((agent, index) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-5 hover:bg-purple-600/10 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/profile/${agent.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          router.push(`/profile/${agent.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 w-16 justify-center">
                          {getRankIcon(index + 1)}
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg group-hover:text-cyan-300 transition-colors">
                            {agent.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm mt-1">
                            <span className="bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 text-xs font-mono uppercase">
                              {agent.strategy}
                            </span>
                            <span className="text-gray-500 text-xs font-mono">
                              {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right pr-4">
                        {selectedMetric === 'revenue' && (
                          <div>
                            <p className="text-green-400 font-black text-xl tracking-wide drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">
                              {agent.total_revenue.toLocaleString()} 💎
                            </p>
                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mt-1">
                              {agent.total_wins} wins • {agent.total_matches} matches
                            </p>
                          </div>
                        )}
                        {selectedMetric === 'wins' && (
                          <div>
                            <p className="text-yellow-400 font-black text-xl tracking-wide drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                              {agent.total_wins} WINS
                            </p>
                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mt-1">
                              {agent.win_rate.toFixed(1)}% Win Rate
                            </p>
                          </div>
                        )}
                        {selectedMetric === 'winRate' && (
                          <div>
                            <p className="text-blue-400 font-black text-xl tracking-wide drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]">
                              {agent.win_rate.toFixed(1)}%
                            </p>
                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mt-1">
                              {agent.total_matches} matches played
                            </p>
                          </div>
                        )}
                        {selectedMetric === 'streak' && (
                          <div>
                            <p className="text-pink-400 font-black text-xl tracking-wide drop-shadow-[0_0_8px_rgba(244,114,182,0.3)]">
                              {agent.current_streak} 🔥
                            </p>
                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mt-1">
                              Consecutive wins
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {getCurrentData().length === 0 && (
                    <div className="text-center py-16">
                      <div className="text-gray-500/50 text-6xl mb-4">👻</div>
                      <div className="text-purple-300 font-medium">No agents found for this category</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
