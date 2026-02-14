import AgentGameRunner from "../services/agentGameRunner.js";
import Agent from "../models/Agent.js";
import AgentGameParticipation from "../models/AgentGameParticipation.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import User from "../models/User.js";
import GameSetting from "../models/GameSetting.js";
import Chat from "../models/Chat.js";

const agentAutonomousController = {
  // Auto-start autonomous battle - follows same flow as frontend
  async autoStartBattle(req, res) {
    try {
      const { agentCount = 4, settings = {} } = req.body;

      console.log(`🤖 [AUTO-START] Starting autonomous battle with ${agentCount} agents...`);

      // 1. Select available agents
      const busyAgentIds = AgentGameRunner.getBusyAgentIds();
      const allAgents = await Agent.findAll({ limit: 100 });
      const availableAgents = allAgents.filter(a => !busyAgentIds.includes(a.id));

      if (availableAgents.length < agentCount) {
        return res.status(400).json({
          success: false,
          message: `Not enough available agents. Need ${agentCount}, found ${availableAgents.length}`
        });
      }

      const selectedAgents = availableAgents
        .sort(() => 0.5 - Math.random())
        .slice(0, agentCount);

      console.log(`✅ [AUTO-START] Selected agents:`, selectedAgents.map(a => a.name));

      // 2. Create game (same as frontend POST /api/games)
      const gameCode = `AUTO_${Date.now()}`;

      // Create system user if not exists
      let systemUser = await User.findByAddress("0x0000000000000000000000000000000000000000", "AI_NET");
      if (!systemUser) {
        systemUser = await User.create({
          username: "AutoSystem",
          address: "0x0000000000000000000000000000000000000000",
          chain: "AI_NET"
        });
      }

      // Create game
      const game = await Game.create({
        code: gameCode,
        mode: "AI",
        creator_id: systemUser.id,
        next_player_id: systemUser.id,
        number_of_players: agentCount,
        status: "PENDING",
        is_agent_only: true // Required for AgentGameRunner
      });

      // Create chat
      await Chat.create({
        game_id: game.id,
        status: "open"
      });

      // Create game settings
      await GameSetting.create({
        game_id: game.id,
        auction: settings.auction ?? true,
        rent_in_prison: settings.rent_in_prison ?? true,
        mortgage: settings.mortgage ?? true,
        even_build: settings.even_build ?? false,
        randomize_play_order: settings.randomize_play_order ?? true,
        starting_cash: settings.starting_cash || 1500
      });

      console.log(`✅ [AUTO-START] Game created with ID: ${game.id}`);

      // 3. Add AI players (same as frontend POST /api/game-players/join)
      const symbols = ['car', 'dog', 'hat', 'thimble', 'boot', 'battleship'];

      for (let i = 0; i < selectedAgents.length; i++) {
        const agent = selectedAgents[i];

        // Get or create user for agent
        let agentUser = await User.findByAddress(agent.address, 'AI_NET');
        if (!agentUser) {
          agentUser = await User.create({
            username: agent.name,
            address: agent.address,
            chain: 'AI_NET'
          });
        }

        // Add as game player
        await GamePlayer.create({
          game_id: game.id,
          user_id: agentUser.id,
          agent_id: agent.id, // Required for AgentGameRunner to load agent data
          is_ai: true,
          address: agent.address,
          balance: settings.starting_cash || 1500,
          position: 0,
          turn_order: i + 1,
          symbol: symbols[i],
          chance_jail_card: false,
          community_chest_jail_card: false
        });
      }

      console.log(`✅ [AUTO-START] Added ${selectedAgents.length} AI players`);

      // 4. Start game (same as frontend PUT /api/games/{id})
      await Game.update(game.id, { status: "RUNNING" });

      console.log(`🎮 [AUTO-START] Game started! Code: ${gameCode}`);

      // 5. Start autonomous execution
      await AgentGameRunner.startAgentGame(game.id);
      console.log(`🤖 [AUTO-START] Agent runner started for game ${game.id}`);

      return res.status(201).json({
        success: true,
        message: "Autonomous battle started successfully",
        data: {
          game_id: game.id,
          game_code: gameCode,
          agents: selectedAgents.map(a => ({
            id: a.id,
            name: a.name,
            strategy: a.strategy
          })),
          spectate_url: `http://localhost:3000/ai-play?gameCode=${gameCode}`,
          autonomous_mode: true
        }
      });
    } catch (error) {
      console.error('❌ [AUTO-START] Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Start autonomous agent-only game
  async startAutonomousGame(req, res) {
    try {
      const { agentIds, settings = {}, ownerAddress } = req.body;

      if (!agentIds || !Array.isArray(agentIds) || agentIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 agent IDs required"
        });
      }

      // Create game using existing agentGameController
      const gameCode = `AUTO_${Date.now()}`;
      const gameSettings = {
        auction: settings.auction ?? false,
        rent_in_prison: settings.rent_in_prison ?? true,
        mortgage: settings.mortgage ?? true,
        even_build: settings.even_build ?? false,
        randomize_play_order: settings.randomize_play_order ?? true,
        starting_cash: settings.starting_cash ?? 1500
      };

      // Import and use agentGameController
      const agentGameControllerModule = await import('./agentGameController.js');
      const { createAgentOnlyGame } = agentGameControllerModule.default;
      const gameResponse = await createAgentOnlyGame({
        body: {
          code: gameCode,
          mode: 'agent-only',
          numberOfPlayers: agentIds.length,
          settings: gameSettings,
          agentIds,
          ownerAddress
        }
      }, {
        status: () => ({ json: (data) => data }),
        json: (data) => data
      });

      if (!gameResponse.success) {
        return res.status(400).json(gameResponse);
      }

      // Start autonomous execution
      await AgentGameRunner.startAgentGame(gameResponse.data.id);

      res.status(201).json({
        success: true,
        message: "Autonomous agent game started successfully",
        data: {
          ...gameResponse.data,
          autonomous_mode: true,
          execution_interval: 3000 // 3 seconds per turn
        }
      });
    } catch (error) {
      console.error("Error starting autonomous game:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get live autonomous games
  async getLiveGames(req, res) {
    try {
      const liveGames = AgentGameRunner.getLiveGames();

      res.json({
        success: true,
        message: "successful",
        data: liveGames
      });
    } catch (error) {
      console.error("Error fetching live games:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get specific game state
  async getGameState(req, res) {
    try {
      const { gameId } = req.params;
      const gameState = AgentGameRunner.getGameState(parseInt(gameId));

      if (!gameState) {
        return res.status(404).json({
          success: false,
          message: "Game not found or not running"
        });
      }

      res.json({
        success: true,
        data: gameState
      });
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Stop autonomous game
  async stopAutonomousGame(req, res) {
    try {
      const { gameId } = req.params;
      await AgentGameRunner.stopAgentGame(parseInt(gameId));

      res.json({
        success: true,
        message: "Game stopped successfully"
      });
    } catch (error) {
      console.error("Error stopping game:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get agent participation history
  async getAgentHistory(req, res) {
    try {
      const { agentId } = req.params;
      const history = await Agent.getHistory(agentId);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // NEW: Start runner for existing game (called by script)
  async startRunner(req, res) {
    try {
      const { gameId } = req.params;
      console.log(`🚀 Starting autonomous runner for game ${gameId}`);

      // Ensure game exists
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ success: false, message: "Game not found" });
      }

      // Start runner
      AgentGameRunner.startAgentGame(game.id);

      res.json({ success: true, message: "Runner started" });
    } catch (error) {
      console.error("Failed to start runner:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export default agentAutonomousController;
