import Agent from "../models/Agent.js";
import Game from "../models/Game.js";
import AgentGameParticipation from "../models/AgentGameParticipation.js";
import AgentGameRunner from "../services/agentGameRunner.js";
import AgentReward from "../models/AgentReward.js";
import db from "../config/database.js";

const agentMatchmakingController = {
  // Auto-matchmaking for agents
  async findMatch(req, res) {
    try {
      const { agentId, gameType = 'quick', maxWaitTime = 30000 } = req.body;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: "Agent ID is required"
        });
      }

      // Get agent info
      const agent = await Agent.findById(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }

      // Find available agents for matchmaking
      const availableAgents = await agentMatchmakingController.findAvailableAgents(agentId, gameType);

      if (availableAgents.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No opponents available"
        });
      }

      // Select opponent based on skill matching
      const opponent = agentMatchmakingController.selectOpponent(agent, availableAgents);

      // Create and start game
      const game = await agentMatchmakingController.createAgentGame([agentId, opponent.id], gameType);

      // Start the autonomous game
      await AgentGameRunner.startAgentGame(game.id);

      res.json({
        success: true,
        message: "Match found and game started",
        data: {
          gameId: game.id,
          players: [
            { id: agent.id, name: agent.name, strategy: agent.strategy },
            { id: opponent.id, name: opponent.name, strategy: opponent.strategy }
          ],
          gameType,
          estimatedDuration: agentMatchmakingController.estimateGameDuration(gameType)
        }
      });
    } catch (error) {
      console.error("Error in matchmaking:", error);
      res.status(500).json({
        success: false,
        message: "Matchmaking failed",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Tournament system
  async createTournament(req, res) {
    try {
      const { name, agentIds, entryFee = 100, prizePool, settings = {} } = req.body;

      if (!agentIds || !Array.isArray(agentIds) || agentIds.length < 4) {
        return res.status(400).json({
          success: false,
          message: "At least 4 agents required for tournament"
        });
      }

      // Verify all agents exist
      const agents = await Promise.all(
        agentIds.map(id => Agent.findById(id))
      );

      if (agents.some(agent => !agent)) {
        return res.status(400).json({
          success: false,
          message: "One or more agents not found"
        });
      }

      // Create tournament
      const tournament = await agentMatchmakingController.createTournamentGames(name, agentIds, entryFee, prizePool, settings);

      res.json({
        success: true,
        message: "Tournament created successfully",
        data: tournament
      });
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(500).json({
        success: false,
        message: "Tournament creation failed",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get active games
  async getActiveGames(req, res) {
    try {
      const liveGames = AgentGameRunner.getLiveGames();

      const gameDetails = await Promise.all(
        liveGames.map(async (game) => {
          const participations = await AgentGameParticipation.findByGameId(game.game_id);
          const agents = await Promise.all(
            participations.map(p => Agent.findById(p.agent_id))
          );

          return {
            gameId: game.game_id,
            status: game.status,
            currentTurn: game.current_turn,
            roundNumber: game.round_number,
            players: agents.map(agent => ({
              id: agent.id,
              name: agent.name,
              strategy: agent.strategy,
              currentBalance: game.agents_playing.find(a => a.id === agent.id)?.balance || 0
            })),
            estimatedTimeLeft: game.estimated_time_left,
            startedAt: game.started_at
          };
        })
      );

      res.json({
        success: true,
        data: gameDetails
      });
    } catch (error) {
      console.error("Error getting active games:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get active games"
      });
    }
  },

  // Helper methods
  async findAvailableAgents(agentId, gameType) {
    const query = db("agents")
      .where("id", "!=", agentId)
      .where("auto_play", true)
      .whereNotNull("strategy");

    // Filter by game type preferences
    if (gameType === 'quick') {
      query.where("risk_profile", "in", ["aggressive", "balanced"]);
    } else if (gameType === 'strategic') {
      query.where("risk_profile", "in", ["balanced", "defensive"]);
    }

    return await query.limit(10);
  },

  selectOpponent(agent, availableAgents) {
    // Skill-based matching using win rate
    const agentWinRate = parseFloat(agent.win_rate) || 50;

    // Find agents with similar skill level (±20% win rate)
    const similarSkillAgents = availableAgents.filter(opponent => {
      const opponentWinRate = parseFloat(opponent.win_rate) || 50;
      const difference = Math.abs(agentWinRate - opponentWinRate);
      return difference <= 20;
    });

    // If no similar skill agents, pick random
    const pool = similarSkillAgents.length > 0 ? similarSkillAgents : availableAgents;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  async createAgentGame(agentIds, gameType) {
    const gameData = {
      code: `AGENT-${Date.now()}`,
      status: 'RUNNING',
      is_agent_only: true,
      max_players: agentIds.length,
      current_players: agentIds.length,
      game_type: gameType,
      settings: JSON.stringify({
        auto_play: true,
        decision_timeout: 30000,
        max_rounds: gameType === 'quick' ? 50 : 100
      })
    };

    const [gameId] = await db("games").insert(gameData);
    const game = await Game.findById(gameId);

    // Create agent participations
    for (const agentId of agentIds) {
      await AgentGameParticipation.create({
        game_id: gameId,
        agent_id: agentId,
        initial_balance: gameType === 'quick' ? 1500 : 2000,
        current_balance: gameType === 'quick' ? 1500 : 2000,
        status: 'ACTIVE'
      });
    }

    return game;
  },

  async createTournamentGames(name, agentIds, entryFee, prizePool, settings) {
    const tournament = {
      name,
      entryFee,
      prizePool: prizePool || (agentIds.length * entryFee),
      participants: agentIds,
      status: 'REGISTERING',
      createdAt: new Date()
    };

    // Store tournament in database (you might want to create a tournaments table)
    await db("tournaments").insert(tournament);

    // Create tournament bracket (simple round-robin for now)
    const games = [];
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const game = await this.createAgentGame(
          [agentIds[i], agentIds[j]],
          'tournament'
        );
        games.push(game);
      }
    }

    return {
      tournament,
      games,
      totalMatches: games.length
    };
  },

  estimateGameDuration(gameType) {
    const durations = {
      quick: 5 * 60 * 1000, // 5 minutes
      strategic: 15 * 60 * 1000, // 15 minutes
      tournament: 20 * 60 * 1000 // 20 minutes
    };
    return durations[gameType] || durations.quick;
  },

  // Manual duel between two agents
  async startDuel(req, res) {
    try {
      const { agentId1, agentId2, gameType = 'quick' } = req.body;

      if (!agentId1 || !agentId2) {
        return res.status(400).json({
          success: false,
          message: "Both agentId1 and agentId2 are required"
        });
      }

      // Verify agents exist
      const agent1 = await Agent.findById(agentId1);
      const agent2 = await Agent.findById(agentId2);

      if (!agent1 || !agent2) {
        return res.status(404).json({
          success: false,
          message: "One or both agents not found"
        });
      }

      // Create and start game
      const game = await agentMatchmakingController.createAgentGame([agentId1, agentId2], gameType);

      // Start the autonomous game
      // We don't await this to avoid blocking the response if it takes time to init
      AgentGameRunner.startAgentGame(game.id).catch(err => {
        console.error(`Failed to start duel game ${game.id}:`, err);
      });

      res.json({
        success: true,
        message: `Duel started between ${agent1.name} and ${agent2.name}`,
        data: {
          gameId: game.id,
          gameCode: game.code,
          players: [
            { id: agent1.id, name: agent1.name },
            { id: agent2.id, name: agent2.name }
          ]
        }
      });

    } catch (error) {
      console.error("Error starting duel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start duel",
        error: error.message
      });
    }
  },

  // Reward distribution
  async distributeRewards(gameId) {
    try {
      const participations = await AgentGameParticipation.findByGameId(gameId);

      // Sort by final balance (rank)
      const sortedParticipations = participations.sort((a, b) => b.final_balance - a.final_balance);

      for (let i = 0; i < sortedParticipations.length; i++) {
        const participation = sortedParticipations[i];
        const rank = i + 1;

        // Calculate reward based on rank
        let rewardAmount = 0;
        if (rank === 1) rewardAmount = 100; // Winner
        else if (rank === 2) rewardAmount = 50; // Second place
        else if (rank === 3) rewardAmount = 25; // Third place

        if (rewardAmount > 0) {
          await AgentReward.create({
            agent_id: participation.agent_id,
            amount: rewardAmount,
            currency: 'USD',
            status: 'PENDING',
            game_id: gameId,
            metadata: JSON.stringify({
              rank,
              final_balance: participation.final_balance,
              game_type: 'autonomous'
            })
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Error distributing rewards:", error);
      return false;
    }
  }
};

export default agentMatchmakingController;
