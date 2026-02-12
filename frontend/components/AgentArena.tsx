'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Play, Users, Clock, DollarSign, TrendingUp, Activity, Zap } from 'lucide-react';

interface Agent {
  id: number;
  name: string;
  strategy: string;
  win_rate: number;
  total_wins: number;
  auto_play: boolean;
}

interface ActiveGame {
  gameId: number;
  status: string;
  currentTurn: number;
  roundNumber: number;
  players: Array<{
    id: number;
    name: string;
    strategy: string;
    currentBalance: number;
  }>;
  estimatedTimeLeft: number;
  startedAt: string;
}

interface MatchRequest {
  agentId: number;
  gameType: 'quick' | 'strategic' | 'tournament';
}

export default function AgentArena() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [gameType, setGameType] = useState<'quick' | 'strategic'>('quick');
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchActiveGames();
    
    // Set up real-time updates
    const interval = setInterval(fetchActiveGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/agents/leaderboard?limit=20`);
      const data = await response.json();
      
      if (data.success) {
        setAgents(data.data.filter((agent: any) => agent.auto_play));
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchActiveGames = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/agent-matchmaking/games/active`);
      const data = await response.json();
      
      if (data.success) {
        setActiveGames(data.data);
      }
    } catch (error) {
      console.error('Error fetching active games:', error);
    }
  };

  const handleAgentSelect = (agentId: number) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const startQuickMatch = async (agentId: number) => {
    setIsCreatingGame(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/agent-matchmaking/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          gameType,
          maxWaitTime: 30000
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Match found! Game ID: ${data.data.gameId}`);
        fetchActiveGames();
      } else {
        alert(`Failed to find match: ${data.message}`);
      }
    } catch (error) {
      console.error('Error starting match:', error);
      alert('Failed to start match');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const createTournament = async () => {
    if (selectedAgents.length < 4) {
      alert('Select at least 4 agents for tournament');
      return;
    }

    setIsCreatingGame(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/agent-matchmaking/tournament`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Tournament ${Date.now()}`,
          agentIds: selectedAgents,
          entryFee: 100,
          prizePool: selectedAgents.length * 100
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Tournament created with ${data.data.totalMatches} matches!`);
        setSelectedAgents([]);
        fetchActiveGames();
      } else {
        alert(`Failed to create tournament: ${data.message}`);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament');
    } finally {
      setIsCreatingGame(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'aggressive': return 'text-red-500';
      case 'balanced': return 'text-blue-500';
      case 'defensive': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Zap className="w-8 h-8 text-yellow-400" />
            Agent Arena
          </h1>
          <p className="text-gray-300">Watch AI agents battle it out and earn rewards!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agent Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" />
                Available Agents
              </h2>
              
              {/* Game Type Selection */}
              <div className="mb-6">
                <label className="text-white text-sm mb-2 block">Game Type</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setGameType('quick')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      gameType === 'quick' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white/20 text-gray-300 hover:bg-white/30'
                    }`}
                  >
                    Quick Match (5 min)
                  </button>
                  <button
                    onClick={() => setGameType('strategic')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      gameType === 'strategic' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white/20 text-gray-300 hover:bg-white/30'
                    }`}
                  >
                    Strategic (15 min)
                  </button>
                </div>
              </div>

              {/* Agent Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    className={`bg-white/5 rounded-lg p-4 border-2 transition-all cursor-pointer ${
                      selectedAgents.includes(agent.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-transparent hover:border-white/20'
                    }`}
                    onClick={() => handleAgentSelect(agent.id)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-white font-semibold">{agent.name}</h3>
                        <span className={`text-sm ${getStrategyColor(agent.strategy)}`}>
                          {agent.strategy?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">{agent.win_rate?.toFixed(1)}%</div>
                        <div className="text-gray-400 text-xs">Win Rate</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-gray-300 text-sm">
                        <Trophy className="w-4 h-4 inline mr-1" />
                        {agent.total_wins} wins
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startQuickMatch(agent.id);
                        }}
                        disabled={isCreatingGame}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                      >
                        {isCreatingGame ? 'Finding...' : 'Quick Match'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tournament Controls */}
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-semibold">Tournament Mode</h3>
                    <p className="text-gray-400 text-sm">
                      {selectedAgents.length} agents selected (min 4)
                    </p>
                  </div>
                  <button
                    onClick={createTournament}
                    disabled={selectedAgents.length < 4 || isCreatingGame}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    {isCreatingGame ? 'Creating...' : 'Start Tournament'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Games */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-400" />
                Live Games
              </h2>
              
              {activeGames.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No active games</p>
                  <p className="text-gray-500 text-sm">Start a match to see the action!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGames.map(game => (
                    <div key={game.gameId} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-white font-semibold">Game #{game.gameId}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            game.status === 'RUNNING' ? 'bg-green-600' : 'bg-yellow-600'
                          } text-white`}>
                            {game.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-300 text-sm">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {formatTime(Math.floor(game.estimatedTimeLeft / 1000))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {game.players.map(player => (
                          <div key={player.id} className="flex justify-between items-center">
                            <div>
                              <span className="text-white text-sm">{player.name}</span>
                              <span className={`text-xs ml-2 ${getStrategyColor(player.strategy)}`}>
                                {player.strategy}
                              </span>
                            </div>
                            <div className="text-green-400 font-bold text-sm">
                              ${player.currentBalance}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Turn: {game.currentTurn}</span>
                          <span>Round: {game.roundNumber}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats Summary */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mt-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                Arena Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Active Agents</span>
                  <span className="text-white font-bold">{agents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Live Games</span>
                  <span className="text-green-400 font-bold">{activeGames.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Total Players</span>
                  <span className="text-blue-400 font-bold">
                    {activeGames.reduce((sum, game) => sum + game.players.length, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
