import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameProperty from "../models/GameProperty.js";
import Property from "../models/Property.js";
import AgentDecisionEngine from "./agentDecisionEngine.js";
import db from "../config/database.js";
import Agent from "../models/Agent.js";
import GamePlayHistory from "../models/GamePlayHistory.js";

// Import io from server (will be initialized later)
let io;
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

class AgentGameRunner {
  constructor() {
    this.activeGames = new Map(); // gameId -> game state
    this.gameIntervals = new Map(); // gameId -> interval reference
    this.decisionEngine = new AgentDecisionEngine();
  }

  async startAgentGame(gameId) {
    try {
      console.log(`🎮 [GAME RUNNER] Starting agent game ${gameId}...`);

      const game = await Game.findById(gameId);
      console.log(`📋 [GAME RUNNER] Game found:`, { id: game?.id, status: game?.status, is_agent_only: game?.is_agent_only });

      // Infer spectator mode: Check if creator is playing
      // We need to fetch players to check this, or just rely on manual start.
      // Since this method is called explicitly for a game ID, we should trust it.
      // But let's keep the RUNNING check.

      const isRunnable = true; // Use simple trust since startAgentGame is called explicitly by controller

      if (!game || game.status !== 'RUNNING') {
        throw new Error(`Invalid agent game: ${!game ? 'not found' : 'status=' + game.status}`);
      }

      // Initialize game state
      console.log(`🔧 [GAME RUNNER] Initializing game state...`);
      const gameState = await this.initializeGameState(game);
      console.log(`✅ [GAME RUNNER] Game state initialized with ${gameState.players.length} players`);

      this.activeGames.set(gameId, gameState);

      // Start automatic turn execution
      console.log(`⏰ [GAME RUNNER] Starting automatic turn execution...`);
      this.startAutomaticTurnExecution(gameId);

      console.log(`🤖 Agent-only game ${gameId} started automatically`);

      // Emit game start to spectators
      if (io) {
        io.emit('agent_game_started', {
          game_id: gameId,
          agents: gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            strategy: p.strategy
          }))
        });
        console.log(`📡 [GAME RUNNER] Emitted game_started event`);
      } else {
        console.warn(`⚠️ [GAME RUNNER] Socket.io not initialized, cannot emit events`);
      }

    } catch (error) {
      console.error('Error starting agent game:', error);
      throw error;
    }
  }

  async initializeGameState(game) {
    const players = await GamePlayer.findByGameId(game.id);
    const properties = await Property.findAll(); // Properties are static board data
    const gameProperties = await GameProperty.findByGameId(game.id); // Dynamic ownership data

    // Map game properties for easy lookup
    const gamePropertyMap = new Map();
    gameProperties.forEach(gp => {
      gamePropertyMap.set(gp.property_id, gp);
    });

    // Merge static and dynamic data
    const mergedProperties = properties.map(p => {
      const gp = gamePropertyMap.get(p.id);
      return {
        ...p,
        owner_id: gp ? gp.player_id : null,
        is_mortgaged: gp ? gp.mortgaged : false,
        houses: gp ? gp.development : 0, // Assuming development stores house count
        hotels: gp && gp.development === 5 ? 1 : 0 // Simplified hotel logic
      };
    });

    // Enrich players with agent data
    const enrichedPlayers = await Promise.all(
      players.map(async (player) => {
        // If is_ai is true OR if username is missing OR username looks like an AI bot
        if (player.is_ai || !player.username || (player.username && player.username.startsWith("AI_Bot_"))) {
          let agentData = {
            name: player.username || `Agent ${player.turn_order}`,
            strategy: 'balanced',
            risk_profile: 'balanced',
            config: {}
          };

          if (player.agent_id) {
            // Get agent details from DB
            const [agentDetails] = await db('agents')
              .where('id', player.agent_id)
              .select('name', 'strategy', 'risk_profile', 'config');

            if (agentDetails) {
              agentData.name = agentDetails.name;
              agentData.strategy = agentDetails.strategy || 'balanced';
              agentData.risk_profile = agentDetails.risk_profile || 'balanced';

              if (agentDetails.config) {
                agentData.config = typeof agentDetails.config === 'string'
                  ? JSON.parse(agentDetails.config)
                  : agentDetails.config;
              }
            }
          }

          return {
            ...player,
            agent_name: agentData.name,
            strategy: agentData.strategy,
            risk_profile: agentData.risk_profile,
            config: agentData.config
          };
        }
        return player;
      })
    );

    return {
      gameId: game.id,
      status: game.status,
      currentRound: 1,
      currentTurn: 0,
      players: enrichedPlayers,
      properties: mergedProperties,
      boardPosition: 0,
      diceRoll: null,
      lastAction: null,
      gameLog: [],
      startTime: new Date()
    };
  }

  startAutomaticTurnExecution(gameId) {
    const execute = async () => {
      if (!this.gameIntervals.has(gameId)) return;

      await this.executeNextTurn(gameId);

      // Schedule next turn in 5 seconds to allow frontend animations to finish
      const nextTimer = setTimeout(execute, 5000);
      this.gameIntervals.set(gameId, nextTimer);
    };

    const initialTimer = setTimeout(execute, 2000);
    this.gameIntervals.set(gameId, initialTimer);
  }

  async executeNextTurn(gameId) {
    try {
      console.log(`\n🔄 [TURN] Executing turn for game ${gameId}...`);

      const gameState = this.activeGames.get(gameId);
      if (!gameState) {
        console.error(`❌ [TURN] No game state found for game ${gameId}`);
        this.stopGame(gameId);
        return;
      }

      if (gameState.status !== 'RUNNING') {
        console.log(`⏹️ [TURN] Game ${gameId} is not running (status: ${gameState.status})`);
        this.stopGame(gameId);
        return;
      }

      // CRITICAL FIX: Refresh player data from database before each turn
      // This ensures we have current balances, positions, and property ownership
      const freshPlayers = await GamePlayer.findByGameId(gameId);
      gameState.players = freshPlayers.map(p => {
        const existingPlayer = gameState.players.find(ep => ep.id === p.id);
        return {
          ...p,
          agent_name: existingPlayer?.agent_name || p.username,
          strategy: existingPlayer?.strategy || 'balanced',
          risk_profile: existingPlayer?.risk_profile || 'balanced',
          config: existingPlayer?.config || {}
        };
      });

      // Get current player
      const currentPlayer = this.getCurrentPlayer(gameState);
      if (!currentPlayer) {
        await this.endGame(gameId);
        return;
      }

      console.log(`🎯 Agent ${currentPlayer.agent_name} taking turn in game ${gameId} (Balance: $${currentPlayer.balance})`);

      // Roll dice
      const diceRoll = this.rollDice();
      gameState.diceRoll = diceRoll;
      gameState.boardPosition = (currentPlayer.position + diceRoll) % 40;

      console.log(`🎲 ${currentPlayer.agent_name} rolled a ${diceRoll}. Moving to position ${gameState.boardPosition}.`);

      // Update player position in database
      await GamePlayer.update(currentPlayer.id, {
        position: gameState.boardPosition
      });

      // Update in-memory position immediately
      currentPlayer.position = gameState.boardPosition;

      // Get current property at new position
      // Corrected to use ID matching
      const currentProperty = gameState.properties.find(
        p => p.id === gameState.boardPosition
      );

      if (currentProperty) {
        console.log(`📍 Landed on: ${currentProperty.name} (Price: $${currentProperty.price})`);
      } else {
        console.log(`📍 Landed on special space.`);
      }

      // Make decision using AI engine
      const agent = {
        id: currentPlayer.agent_id,
        name: currentPlayer.agent_name,
        strategy: currentPlayer.strategy,
        risk_profile: currentPlayer.risk_profile,
        config: currentPlayer.config
      };

      const decision = await this.decisionEngine.makeDecision({
        current_player: currentPlayer,
        players: gameState.players,
        properties: gameState.properties,
        board_position: gameState.boardPosition,
        dice_roll: diceRoll,
        current_property: currentProperty
      }, agent);

      // Execute the decision
      await this.executeDecision(gameState, decision, currentPlayer);

      // Refresh player data again after decision execution to get updated balances
      const updatedPlayers = await GamePlayer.findByGameId(gameId);
      gameState.players = updatedPlayers.map(p => {
        const existingPlayer = gameState.players.find(ep => ep.id === p.id);
        return {
          ...p,
          agent_name: existingPlayer?.agent_name || p.username,
          strategy: existingPlayer?.strategy || 'balanced',
          risk_profile: existingPlayer?.risk_profile || 'balanced',
          config: existingPlayer?.config || {}
        };
      });

      // Update game state
      gameState.lastAction = decision;

      // Save action to database history (so frontend can see it)
      await GamePlayHistory.create({
        game_id: gameId,
        game_player_id: currentPlayer.id,
        new_position: gameState.boardPosition,
        action: decision.type, // Now VARCHAR(255) so 'buy_property' etc works
        amount: 0, // Could be price/rent if available in decision data
        comment: decision.reasoning || `${currentPlayer.agent_name} decided to ${decision.type}`,
        active: 1
      });

      // Keep in-memory log for any other internal use (optional)
      gameState.gameLog.push({
        round: gameState.currentRound,
        player: currentPlayer.agent_name,
        action: decision.type,
        dice_roll: diceRoll,
        position: gameState.boardPosition,
        timestamp: new Date()
      });

      // Emit real-time update to spectators
      if (io) {
        io.emit('agent_turn_completed', {
          game_id: gameId,
          player: currentPlayer.agent_name,
          action: decision.type,
          dice_roll: diceRoll,
          position: gameState.boardPosition,
          reasoning: decision.reasoning
        });
        console.log(`📡 [TURN] Emitted turn_completed for ${currentPlayer.agent_name}`);
      }

      // Move to next player
      this.moveToNextPlayer(gameState);

      // Update current_turn in database so frontend can display it
      const nextPlayer = this.getCurrentPlayer(gameState);
      if (nextPlayer) {
        await Game.update(gameId, {
          current_turn: nextPlayer.id
        });
      }

      // Check win conditions
      await this.checkWinConditions(gameId);

    } catch (error) {
      console.error('Error executing turn:', error);
      io.emit('agent_game_error', {
        game_id: gameId,
        error: error.message
      });
    }
  }

  async executeDecision(gameState, decision, player) {
    switch (decision.type) {
      case 'buy_property':
        await this.handleBuyProperty(decision.data.property_id, player);
        break;

      case 'pay_rent':
        await this.handlePayRent(decision.data.property_id, player, gameState.players);
        break;

      case 'mortgage':
        await this.handleMortgage(decision.data.property_id, player);
        break;

      case 'unmortgage':
        await this.handleUnmortgage(decision.data.property_id, player);
        break;

      case 'build_house':
        await this.handleBuildHouse(decision.data.property_id, player);
        break;

      case 'build_hotel':
        await this.handleBuildHotel(decision.data.property_id, player);
        break;

      case 'propose_trade':
        await this.handleTradeProposal(decision.data, player);
        break;

      case 'end_turn':
        // No action needed
        break;

      default:
        console.warn(`Unknown action type: ${decision.type}`);
    }
  }

  async handleBuyProperty(propertyId, player) {
    try {
      const property = await Property.findById(propertyId);

      // Check if property is purchasable (has a price > 0)
      if (!property || !property.price || property.price <= 0) {
        console.log(`⏭️  ${player.agent_name} cannot buy ${property?.name || 'this space'} - not purchasable`);
        return false;
      }

      // Check if already owned in this game
      const existingOwner = await GameProperty.findByGameId(player.game_id)
        .then(props => props.find(p => p.property_id === propertyId));

      if (existingOwner) {
        console.log(`⏭️  ${player.agent_name} cannot buy ${property.name} - already owned`);
        return false;
      }

      if (player.balance < property.price) {
        console.log(`⏭️  ${player.agent_name} cannot afford ${property.name} ($${property.price})`);
        return false;
      }

      // Create ownership record
      await GameProperty.create({
        game_id: player.game_id,
        player_id: player.id,
        property_id: propertyId,
        mortgaged: false,
        development: 0
      });

      // Deduct from player balance
      await GamePlayer.update(player.id, {
        balance: player.balance - property.price
      });

      console.log(`💰 ${player.agent_name} bought ${property.name} for $${property.price}`);

      // Update local game state
      const gameState = this.activeGames.get(player.game_id);
      if (gameState) {
        const prop = gameState.properties.find(p => p.id === propertyId);
        if (prop) prop.owner_id = player.id;
      }

      return true;
    } catch (error) {
      console.error('Error buying property:', error);
      return false;
    }
  }

  async handlePayRent(propertyId, player, allPlayers) {
    try {
      // Find ownership info from database
      const gameProperty = await GameProperty.findByGameId(player.game_id)
        .then(props => props.find(p => p.property_id === propertyId));

      if (!gameProperty || gameProperty.player_id === player.id) {
        return false;
      }

      const property = await Property.findById(propertyId);
      const owner = allPlayers.find(p => p.id === gameProperty.player_id);
      if (!owner) return false;

      // Calculate rent
      let rent = property.base_rent || 0;
      // Add logic for houses/hotels if available in property model columns
      // For now using base rent to be safe

      // Check if player can pay rent
      if (player.balance < rent) {
        await this.handleBankruptcy(player, owner, rent);
        return false;
      }

      // Transfer rent
      await GamePlayer.update(player.id, {
        balance: player.balance - rent
      });

      await GamePlayer.update(owner.id, {
        balance: owner.balance + rent
      });

      console.log(`💸 ${player.agent_name} paid $${rent} rent to ${owner.agent_name}`);
      return true;
    } catch (error) {
      console.error('Error paying rent:', error);
      return false;
    }
  }

  async handleMortgage(propertyId, player) {
    try {
      const gameProperty = await GameProperty.findByPlayerIdAndGameId(player.id, player.game_id);
      // Need specific property, findByPlayerIdAndGameId might return one, usually need array filter
      // Using simpler logic:
      const ownedProperties = await GameProperty.findByGameId(player.game_id);
      const targetProp = ownedProperties.find(p => p.property_id === propertyId && p.player_id === player.id);

      if (!targetProp || targetProp.mortgaged) {
        return false;
      }

      const property = await Property.findById(propertyId);
      const mortgageValue = Math.floor(property.price * 0.5);

      await GameProperty.update(targetProp.id, {
        mortgaged: true
      });

      await GamePlayer.update(player.id, {
        balance: player.balance + mortgageValue
      });

      console.log(`🏦 ${player.agent_name} mortgaged ${property.name} for $${mortgageValue}`);

      // Update local state
      const gameState = this.activeGames.get(player.game_id);
      if (gameState) {
        const prop = gameState.properties.find(p => p.id === propertyId);
        if (prop) prop.is_mortgaged = true;
      }

      return true;
    } catch (error) {
      console.error('Error mortgaging property:', error);
      return false;
    }
  }

  async handleUnmortgage(propertyId, player) {
    // similar logic but reverse
    return false; // Skip for now to keep it simple, focus on buying
  }

  async handleBuildHouse(propertyId, player) {
    // Implementation relying on GameProperty development column
    return false;
  }

  async handleBuildHotel(propertyId, player) {
    return false;
  }

  async handleTradeProposal(tradeData, player) {
    // Simplified trade handling - would need more complex logic
    console.log(`🤝 ${player.agent_name} proposed a trade`);
    return true;
  }

  async handleBankruptcy(player, creditor, amount) {
    // Simplified bankruptcy handling
    console.log(`💀 ${player.agent_name} went bankrupt owing $${amount} to ${creditor.agent_name}`);

    // Transfer all properties to creditor
    const properties = await Property.findByOwner(player.id);
    for (const property of properties) {
      await Property.update(property.id, {
        owner_id: creditor.id
      });
    }

    // Set player balance to 0
    await GamePlayer.update(player.id, {
      balance: 0
    });
  }

  getCurrentPlayer(gameState) {
    const activePlayers = gameState.players.filter(p => p.balance > 0);
    if (activePlayers.length === 0) return null;

    const playerIndex = gameState.currentTurn % activePlayers.length;
    return activePlayers[playerIndex];
  }

  moveToNextPlayer(gameState) {
    gameState.currentTurn++;

    // Check if we've completed a round
    const activePlayers = gameState.players.filter(p => p.balance > 0);
    if (gameState.currentTurn % activePlayers.length === 0) {
      gameState.currentRound++;
    }
  }

  rollDice() {
    return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  }

  async checkWinConditions(gameId) {
    const gameState = this.activeGames.get(gameId);
    if (!gameState) return;

    const activePlayers = gameState.players.filter(p => p.balance > 0);

    // Win condition 1: Only one player remaining
    if (activePlayers.length === 1) {
      await this.endGame(gameId, activePlayers[0]);
      return;
    }

    // Win condition 2: Turn limit reached (100 rounds)
    if (gameState.currentRound >= 100) {
      const winner = activePlayers.sort((a, b) => b.balance - a.balance)[0];
      await this.endGame(gameId, winner);
      return;
    }
  }

  async endGame(gameId, winner = null) {
    try {
      const gameState = this.activeGames.get(gameId);
      if (!gameState) return;

      // Update game status
      await Game.update(gameId, {
        status: 'COMPLETED',
        winner_id: winner?.id || null
      });

      gameState.status = 'COMPLETED';

      // Emit game end to spectators
      io.emit('agent_game_ended', {
        game_id: gameId,
        winner: winner?.agent_name,
        final_standings: gameState.players
          .filter(p => p.balance > 0)
          .sort((a, b) => b.balance - a.balance)
          .map(p => ({
            name: p.agent_name,
            balance: p.balance,
            properties: gameState.properties.filter(prop => prop.owner_id === p.id).length
          })),
        total_rounds: gameState.currentRound,
        duration: Date.now() - gameState.startTime.getTime()
      });

      // Stop automatic execution
      this.stopGame(gameId);

      console.log(`🏁 Agent-only game ${gameId} ended. Winner: ${winner?.agent_name || 'None'}`);

      // Update stats for all agents involved
      const endStats = gameState.players
        .filter(p => p.agent_id) // Only agents
        .map(p => ({
          id: p.agent_id,
          isWinner: winner && winner.id === p.id,
          revenue: p.balance
        }));

      for (const stat of endStats) {
        await Agent.updateStats(stat.id, {
          wins: stat.isWinner ? 1 : 0,
          matches: 1,
          revenue: stat.revenue
        });
      }

    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  stopGame(gameId) {
    const interval = this.gameIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.gameIntervals.delete(gameId);
    }

    this.activeGames.delete(gameId);
  }

  getLiveGames() {
    const liveGames = [];

    for (const [gameId, gameState] of this.activeGames) {
      const activePlayers = gameState.players.filter(p => p.balance > 0);

      liveGames.push({
        game_id: gameId,
        agents_playing: activePlayers.map(p => ({
          id: p.id,
          name: p.agent_name,
          strategy: p.strategy,
          balance: p.balance
        })),
        current_turn: gameState.currentTurn,
        round_number: gameState.currentRound,
        remaining_agents: activePlayers.length,
        estimated_time_left: Math.max(0, (100 - gameState.currentRound) * 3 * activePlayers.length), // seconds
        last_action: gameState.lastAction?.type,
        status: gameState.status
      });
    }

    return liveGames;
  }

  getGameState(gameId) {
    return this.activeGames.get(gameId);
  }

  getBusyAgentIds() {
    const busyAgentIds = new Set();
    for (const gameState of this.activeGames.values()) {
      if (gameState.status === 'RUNNING') {
        gameState.players.forEach(p => {
          if (p.agent_id) busyAgentIds.add(p.agent_id);
        });
      }
    }
    return Array.from(busyAgentIds);
  }
}

export default new AgentGameRunner();
