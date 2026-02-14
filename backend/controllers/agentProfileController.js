import Agent from "../models/Agent.js";
import AgentGameParticipation from "../models/AgentGameParticipation.js";
import AgentReward from "../models/AgentReward.js";
import AgentGameRunner from "../services/agentGameRunner.js";

const agentProfileController = {
  // Safe JSON parsing method
  safeJsonParse(jsonString) {
    try {
      if (typeof jsonString === 'object' && jsonString !== null) {
        return jsonString;
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parsing error:', error);
      return {};
    }
  },

  // Get agent profile by ID
  async getAgentProfile(req, res) {
    try {
      const { agentId } = req.params;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: "Agent ID is required"
        });
      }

      // Get agent information
      const agent = await Agent.findById(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }

      // Get detailed stats
      const detailed_stats = await agentProfileController.getDetailedStats(agentId);

      // Get performance metrics
      const performance_metrics = await agentProfileController.getPerformanceMetrics(agentId);

      // Get recent games
      const recent_games = await agentProfileController.getRecentGames(agentId);

      // Get rewards
      const rewards = await agentProfileController.getRewards(agentId);

      // Get live game info
      const live_game = agentProfileController.getCurrentLiveGameInfo(agentId);

      res.json({
        success: true,
        message: "Agent profile retrieved successfully",
        data: {
          agent: {
            id: agent.id,
            name: agent.name,
            address: agent.address,
            strategy: agent.strategy,
            risk_profile: agent.risk_profile,
            config: agent.config ? agentProfileController.safeJsonParse(agent.config) : undefined,
            total_wins: agent.total_wins,
            total_matches: agent.total_matches,
            total_revenue: agent.total_revenue,
            win_rate: parseFloat(agent.win_rate) || 0,
            current_streak: agent.current_streak,
            created_at: agent.created_at,
            updated_at: agent.updated_at,
            owner_address: agent.owner_address,
            username: agent.username,
            owner_email: agent.owner_email,
            wallet_address: agent.wallet_address,
            eth_balance: agent.eth_balance,
            tyc_balance: agent.tyc_balance,
            usdc_balance: agent.usdc_balance
          },
          detailed_stats,
          performance_metrics,
          recent_games,
          rewards,
          live_game
        }
      });
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch agent profile",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get detailed statistics
  async getDetailedStats(agentId) {
    try {
      const stats = await AgentGameParticipation.getAgentStats(agentId);
      return {
        totalGames: stats.totalGames || 0,
        wins: stats.wins || 0,
        winRate: stats.winRate || 0,
        avgFinalBalance: stats.avgFinalBalance || 0,
        avgPropertiesOwned: stats.avgPropertiesOwned || 0,
        avgRank: stats.avgRank || 0
      };
    } catch (error) {
      console.error('Error getting detailed stats:', error);
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        avgFinalBalance: 0,
        avgPropertiesOwned: 0,
        avgRank: 0
      };
    }
  },

  // Get performance metrics
  async getPerformanceMetrics(agentId) {
    try {
      const recentGames = await this.getRecentGames(agentId);

      if (!recentGames || recentGames.length === 0) {
        return {
          avg_final_balance: 0,
          avg_properties_owned: 0,
          avg_rank: 0,
          best_rank: null,
          worst_rank: null,
          recent_form: 'no_games',
          games_analyzed: 0
        };
      }

      const totalBalance = recentGames.reduce((sum, game) => sum + game.final_balance, 0);
      const totalProperties = recentGames.reduce((sum, game) => sum + game.properties_owned, 0);
      const totalRank = recentGames.reduce((sum, game) => sum + game.rank, 0);
      const ranks = recentGames.map(game => game.rank);

      const recentForm = this.calculateRecentForm(recentGames);

      return {
        avg_final_balance: Math.round(totalBalance / recentGames.length),
        avg_properties_owned: Math.round(totalProperties / recentGames.length),
        avg_rank: Math.round(totalRank / recentGames.length),
        best_rank: Math.min(...ranks),
        worst_rank: Math.max(...ranks),
        recent_form: recentForm,
        games_analyzed: recentGames.length
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        avg_final_balance: 0,
        avg_properties_owned: 0,
        avg_rank: 0,
        best_rank: null,
        worst_rank: null,
        recent_form: 'unknown',
        games_analyzed: 0
      };
    }
  },

  // Get recent games
  async getRecentGames(agentId) {
    try {
      // Use findByAgentId since getRecentGames doesn't exist
      const games = await AgentGameParticipation.findByAgentId(agentId, { limit: 10 });
      return games.map(game => ({
        game_id: game.game_id,
        game_code: game.game_code || `GAME-${game.game_id}`,
        final_balance: game.final_balance,
        won: game.won,
        rank: game.rank,
        properties_owned: game.properties_owned,
        finished_at: game.finished_at
      }));
    } catch (error) {
      console.error('Error getting recent games:', error);
      return [];
    }
  },

  // Get rewards
  async getRewards(agentId) {
    try {
      // Use the correct method names that exist
      const totalRewards = await AgentReward.getTotalRewardsByAgent(agentId);
      const claimableRewards = await AgentReward.getClaimableRewards(agentId);
      const recentRewards = await AgentReward.findByAgentId(agentId, { limit: 5 });

      return {
        total: totalRewards,
        claimable: claimableRewards,
        recent: recentRewards.map(reward => ({
          id: reward.id,
          amount: reward.amount,
          currency: reward.currency,
          status: reward.status,
          earned_at: reward.earned_at,
          game_id: reward.game_id,
          metadata: reward.metadata ? JSON.parse(reward.metadata) : {}
        }))
      };
    } catch (error) {
      console.error('Error getting rewards:', error);
      return {
        total: 0,
        claimable: 0,
        recent: []
      };
    }
  },

  // Get current live game info
  getCurrentLiveGameInfo(agentId) {
    try {
      const liveGames = AgentGameRunner.getLiveGames();
      const currentGame = liveGames.find(game =>
        game.agents_playing.some(playingAgent => playingAgent.id === parseInt(agentId))
      );

      if (!currentGame) {
        return null;
      }

      const agentInGame = currentGame.agents_playing.find(agent => agent.id === parseInt(agentId));

      return {
        game_id: currentGame.game_id,
        current_turn: currentGame.current_turn,
        round_number: currentGame.round_number,
        remaining_agents: currentGame.agents_playing.length,
        estimated_time_left: currentGame.estimated_time_left || 0,
        last_action: agentInGame?.last_action || 'waiting',
        status: currentGame.status
      };
    } catch (error) {
      console.error('Error getting live game info:', error);
      return null;
    }
  },

  // Calculate recent form based on last 5 games
  calculateRecentForm(recentGames) {
    if (!recentGames || recentGames.length === 0) {
      return 'no_games';
    }

    const last5Games = recentGames.slice(0, 5);
    const wins = last5Games.filter(game => game.won).length;
    const winRate = wins / last5Games.length;

    if (winRate >= 0.8) return 'excellent';
    if (winRate >= 0.6) return 'good';
    if (winRate >= 0.4) return 'average';
    if (winRate >= 0.2) return 'poor';
    return 'terrible';
  }
};

export default agentProfileController;
