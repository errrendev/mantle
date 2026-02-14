import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import Property from "../models/Property.js";
import Agent from "../models/Agent.js";
import AgentGameParticipation from "../models/AgentGameParticipation.js";
import AgentReward from "../models/AgentReward.js";
import User from "../models/User.js";
import AgentGameRunner from "../services/agentGameRunner.js";

const agentGameController = {
  async createAgentOnlyGame(req, res) {
    try {
      const {
        code,
        mode = 'AI',
        numberOfPlayers = 4,
        settings,
        agentIds,
        ownerAddress
      } = req.body;

      if (!code || !settings || !agentIds || !Array.isArray(agentIds)) {
        return res.status(400).json({
          success: false,
          message: "Code, settings, and agentIds are required"
        });
      }

      /*
      // Verify owner owns all agents
      const ownerAgents = await Agent.findByOwner(ownerAddress);
      const ownerAgentIds = ownerAgents.map(agent => agent.id);
      const hasPermission = agentIds.every(id => ownerAgentIds.includes(id));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You don't own all the specified agents"
        });
      }
      */

      // Create game
      const game = await Game.create({
        code,
        mode,
        creator_id: ownerAgentIds[0], // Use first agent as creator
        next_player_id: null, // Will be set when game starts
        number_of_players: numberOfPlayers,
        status: "PENDING",
        is_agent_only: true
      });

      // Create game settings
      const gameSettings = await GameSetting.create({
        game_id: game.id,
        auction: settings.auction,
        rent_in_prison: settings.rent_in_prison,
        mortgage: settings.mortgage,
        even_build: settings.even_build,
        randomize_play_order: settings.randomize_play_order,
        starting_cash: settings.starting_cash,
      });

      // Add agents as players
      const gamePlayers = [];
      for (let i = 0; i < Math.min(agentIds.length, numberOfPlayers); i++) {
        const agent = await Agent.findById(agentIds[i]);
        if (!agent) continue;

        // Get or create AI user for this agent
        let aiUser = await User.findByAddress(agent.address, 'AI_NET');
        if (!aiUser) {
          aiUser = await User.create({
            username: agent.name,
            address: agent.address,
            chain: 'AI_NET'
          });
        }

        const player = await GamePlayer.create({
          game_id: game.id,
          user_id: aiUser.id,
          address: aiUser.address,
          balance: settings.starting_cash,
          position: 0,
          turn_order: i + 1,
          symbol: i + 1,
          chance_jail_card: false,
          community_chest_jail_card: false,
          is_ai: true,
          agent_id: agent.id
        });

        // Create participation record
        await AgentGameParticipation.create({
          agent_id: agent.id,
          game_id: game.id,
          user_id: aiUser.id
        });

        gamePlayers.push(player);
      }

      // Fill remaining slots with random AI agents if needed
      if (gamePlayers.length < numberOfPlayers) {
        const additionalAgents = await Agent.findAll({
          limit: numberOfPlayers - gamePlayers.length,
          offset: 0
        });

        for (let i = gamePlayers.length; i < numberOfPlayers; i++) {
          const agent = additionalAgents[i - gamePlayers.length];
          if (!agent) continue;

          let aiUser = await User.findByAddress(agent.address, 'AI_NET');
          if (!aiUser) {
            aiUser = await User.create({
              username: agent.name,
              address: agent.address,
              chain: 'AI_NET'
            });
          }

          const player = await GamePlayer.create({
            game_id: game.id,
            user_id: aiUser.id,
            address: aiUser.address,
            balance: settings.starting_cash,
            position: 0,
            turn_order: i + 1,
            symbol: i + 1,
            chance_jail_card: false,
            community_chest_jail_card: false,
            is_ai: true,
            agent_id: agent.id
          });

          await AgentGameParticipation.create({
            agent_id: agent.id,
            game_id: game.id,
            user_id: aiUser.id
          });

          gamePlayers.push(player);
        }
      }

      // Start the game if we have enough players
      if (gamePlayers.length >= numberOfPlayers) {
        await Game.update(game.id, {
          status: "RUNNING",
          next_player_id: gamePlayers[0].user_id
        });
        game.status = "RUNNING";
        game.next_player_id = gamePlayers[0].user_id;

        // 🔥 START AUTONOMOUS GAMEPLAY
        try {
          await AgentGameRunner.startAgentGame(game.id);
          console.log(`🤖 Autonomous gameplay started for game ${game.id}`);
        } catch (runnerError) {
          console.error('❌ Error starting autonomous gameplay:', runnerError.message);
          console.error('❌ Full error:', runnerError);
          // Don't fail the request, game is created successfully
        }
      }

      return res.status(201).json({
        success: true,
        message: "Agent-only game created successfully",
        data: {
          ...game,
          settings: gameSettings,
          players: gamePlayers
        }
      });
    } catch (error) {
      console.error("Error creating agent-only game:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getAgentOnlyGames(req, res) {
    try {
      const { limit = 50, offset = 0, status } = req.query;

      let query = db("games").where('is_agent_only', true);

      if (status) {
        query = query.where('status', status);
      }

      const games = await query
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // Enrich with players and settings
      const enrichedGames = await Promise.all(
        games.map(async (game) => ({
          ...game,
          settings: await GameSetting.findByGameId(game.id),
          players: await GamePlayer.findByGameId(game.id),
          participations: await AgentGameParticipation.findByGameId(game.id)
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: enrichedGames
      });
    } catch (error) {
      console.error("Error fetching agent-only games:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async endAgentGame(req, res) {
    try {
      const { gameId } = req.params;

      const game = await Game.findById(gameId);
      if (!game || !game.is_agent_only) {
        return res.status(404).json({
          success: false,
          message: "Agent-only game not found"
        });
      }

      // Get final game state
      const players = await GamePlayer.findByGameId(gameId);
      const participations = await AgentGameParticipation.findByGameId(gameId);

      // Calculate rankings and distribute rewards
      const rankedPlayers = players
        .filter(p => p.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      // Reward distribution
      const rewardPool = players.length * 100; // Base reward pool
      const rewardDistribution = [0.5, 0.3, 0.15, 0.05]; // Winner gets 50%, etc.

      for (let i = 0; i < rankedPlayers.length; i++) {
        const player = rankedPlayers[i];
        const participation = participations.find(p => p.user_id === player.user_id);

        if (!participation) continue;

        const rewardAmount = rewardPool * (rewardDistribution[i] || 0.01);
        const won = i === 0;

        // Update participation record
        await AgentGameParticipation.updateGameResult(
          participation.agent_id,
          gameId,
          {
            final_balance: player.balance,
            final_position: player.position,
            won,
            rank: i + 1,
            properties_owned: player.properties_owned || 0,
            houses_built: player.houses_built || 0,
            hotels_built: player.hotels_built || 0
          }
        );

        // Create reward record
        if (rewardAmount > 0) {
          await AgentReward.create({
            agent_id: participation.agent_id,
            game_id: gameId,
            amount: rewardAmount,
            currency: 'POINTS',
            metadata: JSON.stringify({
              rank: i + 1,
              final_balance: player.balance,
              won
            })
          });

          // Update agent stats
          await Agent.updateStats(participation.agent_id, {
            wins: won ? 1 : 0,
            matches: 1,
            revenue: rewardAmount
          });
        }
      }

      // Update game status
      await Game.update(gameId, {
        status: "COMPLETED",
        winner_id: rankedPlayers[0]?.user_id || null
      });

      res.json({
        success: true,
        message: "Agent game ended successfully",
        data: {
          rankings: rankedPlayers.map((p, i) => ({
            rank: i + 1,
            player: p,
            reward: rewardPool * (rewardDistribution[i] || 0.01)
          }))
        }
      });
    } catch (error) {
      console.error("Error ending agent game:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export default agentGameController;