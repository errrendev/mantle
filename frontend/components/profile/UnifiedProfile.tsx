'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, Loader2, Trophy, TrendingUp, DollarSign, Star } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const getPerkMetadata = (perk: number) => {
  const data = [
    null,
    { name: 'Extra Turn', icon: <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-3xl">⚡</div> },
    { name: 'Get Out of Jail Free', icon: <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl">👑</div> },
    { name: 'Double Rent', icon: <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center text-3xl">💰</div> },
    { name: 'Roll Boost', icon: <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-3xl">✨</div> },
    { name: 'Instant Cash', icon: <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-3xl">💎</div> },
    { name: 'Teleport', icon: <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center text-3xl">📍</div> },
    { name: 'Shield', icon: <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl">🛡️</div> },
    { name: 'Property Discount', icon: <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center text-3xl">🏠</div> },
    { name: 'Tax Refund', icon: <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center text-3xl">↩️</div> },
    { name: 'Exact Roll', icon: <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-3xl">🎯</div> },
  ];
  return data[perk] || { name: `Perk #${perk}`, icon: <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center text-3xl">?</div> };
};

interface Agent {
  id: number;
  name: string;
  address: string;
  strategy?: string;
  risk_profile?: string;
  config?: {
    ai_model?: string;
    api_key?: string;
    initial_amount?: number;
    reasoning_engine?: string;
    decision_timeout?: number;
    auto_play?: boolean;
  };
  total_wins?: number;
  total_matches?: number;
  total_revenue?: number;
  win_rate?: number;
  current_streak?: number;
  created_at?: string;
  updated_at?: string;
  owner_address?: string;
  username?: string;
  owner_email?: string;
  wallet_address?: string;
  eth_balance?: number | string;
  tyc_balance?: number | string;
  usdc_balance?: number | string;
}

interface HumanUser {
  id: number;
  username: string;
  address: string;
  created_at?: string;
}

interface AgentProfileData {
  agent?: Agent;
  user?: HumanUser;
  detailed_stats?: {
    totalGames: number;
    wins: number;
    winRate: number;
    avgFinalBalance: number;
    avgPropertiesOwned: number;
    avgRank: number;
  };
  performance_metrics?: {
    avg_final_balance: number;
    avg_properties_owned: number;
    avg_rank: number;
    best_rank: number | null;
    worst_rank: number | null;
    recent_form: string;
    games_analyzed: number;
  };
  recent_games?: Array<{
    game_id: number;
    game_code: string;
    final_balance: number;
    won: boolean;
    rank: number;
    properties_owned: number;
    finished_at: string;
  }>;
  rewards?: {
    total: number;
    claimable: number;
    recent: Array<{
      id: number;
      amount: number;
      currency: string;
      status: string;
      earned_at: string;
      game_id: number | null;
      metadata: any;
    }>;
  };
  live_game?: {
    game_id: number;
    current_turn: number;
    round_number: number;
    remaining_agents: number;
    estimated_time_left: number;
    last_action: string;
    status: string;
  } | null;
}

export default function UnifiedProfile() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.id as string;

  // Web3 hooks for human users
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent profile data
  const [profileData, setProfileData] = useState<AgentProfileData | null>(null);
  const [isAgent, setIsAgent] = useState<boolean>(false);

  useEffect(() => {
    if (profileId) {
      fetchProfileData();
    }
  }, [profileId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

      // Try to fetch as agent first
      const agentResponse = await fetch(`${backendUrl}/api/agent-profiles/${profileId}`);
      const agentData = await agentResponse.json();

      if (agentData.success) {
        setProfileData(agentData.data);
        setIsAgent(true);
        return;
      }

      // If not agent, try to fetch as human user
      if (agentResponse.status === 404) {
        const userResponse = await fetch(`${backendUrl}/api/user-profiles/${profileId}`);
        const userData = await userResponse.json();

        if (userData.success) {
          setProfileData({
            user: userData.data,
            agent: undefined,
            detailed_stats: undefined,
            performance_metrics: undefined,
            recent_games: undefined,
            rewards: undefined,
            live_game: undefined
          });
          setIsAgent(false);
          return;
        }
      }

      setError('Profile not found');
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStrategyColor = (strategy?: string) => {
    if (!strategy) return 'text-gray-500';
    switch (strategy) {
      case 'aggressive': return 'text-red-500';
      case 'balanced': return 'text-blue-500';
      case 'defensive': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-red-900 border border-red-700 text-white px-6 py-4 rounded-lg max-w-md">
          <p className="text-red-200 mb-4">Error: {error}</p>
          <button
            onClick={() => router.back()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-lg max-w-md">
          <p className="text-gray-300 mb-4">Profile not found</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { agent, user, detailed_stats, performance_metrics, recent_games, rewards, live_game } = profileData;

  return (
    <div className="min-h-screen bg-[url('/grid-pattern.svg')] bg-fixed bg-cover bg-no-repeat bg-[#0a001a]">
      {/* Top Neon Glow Bar */}
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80 z-50" />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="bg-[#13082a]/80 backdrop-blur-xl rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] p-8 mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-cyan-600/5 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-purple-500/20 border-2 border-purple-400/30">
                {isAgent ? agent?.name?.charAt(0).toUpperCase() : user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {isAgent ? agent?.name : user?.username || 'Unknown'}
                </h1>
                <p className="text-gray-300 text-sm">
                  {isAgent ? `Agent ID: ${agent?.id}` : `User ID: ${user?.id || 'Unknown'}`}
                </p>
                <p className="text-gray-400 text-sm font-mono">
                  {isAgent ? (agent?.address || 'Unknown') : (user?.address || 'Unknown')}
                </p>
              </div>
            </div>
            <div className="text-right">
              {isAgent && agent ? (
                <>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStrategyColor(agent.strategy)}`}>
                    {agent.strategy?.toUpperCase() || 'N/A'}
                  </span>
                  <span className="ml-2 text-gray-400 text-sm">
                    {agent.risk_profile?.toUpperCase() || 'N/A'}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                  HUMAN PLAYER
                </span>
              )}
            </div>
          </div>

          {/* Agent-specific info */}
          {isAgent && agent && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
              <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20">
                <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">AI Model</p>
                <p className="text-white font-bold">{agent.config?.ai_model || 'N/A'}</p>
              </div>
              <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20">
                <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Joined On</p>
                <p className="text-white font-bold">{new Date((isAgent ? agent?.created_at : user?.created_at) || '').toLocaleDateString()}</p>
              </div>
              <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20">
                <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Auto Play</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${agent.config?.auto_play ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <p className="text-white font-bold">{agent.config?.auto_play ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet & Owner Info - Only for agents */}
          {isAgent && agent && (
            <div className="bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.1)] p-6 mb-8 border border-cyan-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <h2 className="text-xl font-bold text-cyan-300 mb-6 flex items-center gap-2 relative z-10">
                <Wallet className="w-5 h-5 text-cyan-400" />
                Wallet & Owner Info
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {/* Owner Details */}
                <div className="space-y-5">
                  <div>
                    <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Owner Email</p>
                    <p className="text-white font-medium">{agent.owner_email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Wallet Address</p>
                    <p className="text-cyan-100 font-mono text-sm bg-cyan-950/30 border border-cyan-500/30 p-2.5 rounded-lg truncate">
                      {agent.wallet_address || 'Not connected'}
                    </p>
                  </div>
                </div>

                {/* Balances */}
                <div className="space-y-4">
                  <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Wallet Balances</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-purple-900/20 p-3 rounded-xl border border-purple-500/20 text-center">
                      <p className="text-[10px] text-purple-400 font-bold mb-1">MON</p>
                      <p className="text-white font-bold">{parseFloat(String(agent.eth_balance || 0)).toFixed(4)}</p>
                    </div>
                    <div className="bg-purple-900/20 p-3 rounded-xl border border-purple-500/20 text-center">
                      <p className="text-[10px] text-yellow-400 font-bold mb-1">TYC</p>
                      <p className="text-yellow-300 font-bold">{parseFloat(String(agent.tyc_balance || 0)).toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-900/20 p-3 rounded-xl border border-purple-500/20 text-center">
                      <p className="text-[10px] text-green-400 font-bold mb-1">USDC</p>
                      <p className="text-green-300 font-bold">{parseFloat(String(agent.usdc_balance || 0)).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}



        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Stats - Only for agents */}
          {isAgent && (
            <div className="bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-500/30 p-6">
              <h2 className="text-xl font-bold text-yellow-400 mb-6 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Performance Stats
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Total Wins</span>
                  <span className="text-white font-bold text-lg">{agent?.total_wins || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Total Matches</span>
                  <span className="text-white font-bold text-lg">{agent?.total_matches || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Win Rate</span>
                  <span className="text-green-400 font-bold text-lg">{parseFloat(String(agent?.win_rate || 0)).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Total Revenue</span>
                  <span className="text-blue-400 font-bold text-lg">{agent?.total_revenue || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-200">Current Streak</span>
                  <span className="text-orange-400 font-bold text-lg">{agent?.current_streak || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Metrics - Only for agents */}
          {isAgent && performance_metrics && (
            <div className="bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-500/30 p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-400" />
                Advanced Metrics
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Avg Final Balance</span>
                  <span className="text-white font-bold">{performance_metrics.avg_final_balance}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Avg Properties</span>
                  <span className="text-white font-bold">{performance_metrics.avg_properties_owned}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Avg Rank</span>
                  <span className="text-white font-bold">{performance_metrics.avg_rank}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                  <span className="text-purple-200">Best Rank</span>
                  <span className="text-green-400 font-bold">{performance_metrics.best_rank || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-200">Recent Form</span>
                  <span className="text-white font-bold capitalize">{performance_metrics.recent_form}</span>
                </div>
              </div>
            </div>
          )}

          {/* Live Game Status - Only for agents */}
          {isAgent && (
            <div className="bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-500/30 p-6">
              <h2 className="text-xl font-bold text-purple-400 mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-400" />
                Live Game Status
              </h2>
              {live_game ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                    <span className="text-purple-200">Game ID</span>
                    <span className="text-white font-bold">{live_game.game_id}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                    <span className="text-purple-200">Round</span>
                    <span className="text-white font-bold">{live_game.round_number}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                    <span className="text-purple-200">Turn</span>
                    <span className="text-white font-bold">{live_game.current_turn}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-purple-500/10">
                    <span className="text-purple-200">Players Left</span>
                    <span className="text-white font-bold">{live_game.remaining_agents}</span>
                  </div>
                  <div className="mt-4">
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 w-fit">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      LIVE NOW
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-purple-900/10 rounded-xl border border-purple-500/10">
                  <div className="text-4xl mb-3 opacity-50">💤</div>
                  <p className="text-purple-300/60 font-medium">Agent is currently resting</p>
                </div>
              )}
            </div>
          )}

          {/* Recent Games - Only for agents */}
          {isAgent && recent_games && recent_games.length > 0 && (
            <div className="lg:col-span-3 bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-500/30 p-6">
              <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Recent Games
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recent_games.slice(0, 6).map((game, index) => (
                  <div key={game.game_id} className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-bold">Game #{game.game_code}</p>
                        <p className="text-purple-300/60 text-xs">
                          {new Date(game.finished_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${game.won ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                        {game.won ? 'VICTORY' : 'DEFEAT'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-purple-400 uppercase tracking-wider mb-0.5">Rank</p>
                        <p className="text-white font-bold">#{game.rank}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-purple-400 uppercase tracking-wider mb-0.5">Balance</p>
                        <p className="text-green-400 font-mono font-bold">${game.final_balance.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewards - Only for agents */}
          {isAgent && rewards && (
            <div className="lg:col-span-3 bg-[#13082a]/80 backdrop-blur-xl rounded-2xl shadow-lg border border-purple-500/30 p-6">
              <h2 className="text-xl font-bold text-yellow-400 mb-6 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                Rewards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-xl p-6 border border-purple-500/20">
                  <p className="text-purple-200 text-sm mb-1 uppercase tracking-wider">Total Rewards Earned</p>
                  <p className="text-blue-300 font-black text-4xl drop-shadow-[0_0_10px_rgba(147,197,253,0.3)]">{rewards.total}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-900/40 to-green-900/40 rounded-xl p-6 border border-purple-500/20">
                  <p className="text-purple-200 text-sm mb-1 uppercase tracking-wider">Claimable Balance</p>
                  <p className="text-green-300 font-black text-4xl drop-shadow-[0_0_10px_rgba(134,239,172,0.3)]">{rewards.claimable}</p>
                </div>
              </div>
              {rewards.recent && rewards.recent.length > 0 && (
                <div>
                  <h3 className="text-purple-300 font-bold mb-4 uppercase tracking-wider text-sm">Recent Activity</h3>
                  <div className="space-y-3">
                    {rewards.recent.slice(0, 5).map((reward) => (
                      <div key={reward.id} className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">
                            <Coins className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white font-bold">{reward.amount} {reward.currency}</p>
                            <p className="text-purple-400/60 text-xs">
                              {new Date(reward.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${reward.status === 'CLAIMED' ? 'bg-green-500/20 text-green-400' :
                          reward.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                          {reward.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Human User Info - Only for humans */}
          {!isAgent && user && (
            <div className="lg:col-span-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-400" />
                Player Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Account Type</p>
                  <p className="text-blue-400 font-bold text-lg">Human Player</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Member Since</p>
                  <p className="text-white font-bold text-lg">
                    {new Date(user.created_at || '').toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-lg font-medium transition-all duration-200"
          >
            ← Back to Previous Page
          </button>
        </div>
      </div>
    </div>
  );
}
