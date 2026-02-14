import db from "../config/database.js";
import Property from "../models/Property.js";
import GamePlayer from "../models/GamePlayer.js";
import aiDecisionService from "./aiDecisionService.js";

class AgentDecisionEngine {
  constructor() {
    this.reasoningModel = "Gemini_2.5_Flash";
    this.strategies = {
      aggressive: {
        complete_color_groups: 0.9,
        maximize_cashflow: 0.7,
        maintain_liquidity: 0.3,
        avoid_bankruptcy: 0.8,
        maximize_total_assets: 0.8
      },
      balanced: {
        complete_color_groups: 0.7,
        maximize_cashflow: 0.6,
        maintain_liquidity: 0.6,
        avoid_bankruptcy: 0.9,
        maximize_total_assets: 0.6
      },
      defensive: {
        complete_color_groups: 0.5,
        maximize_cashflow: 0.4,
        maintain_liquidity: 0.9,
        avoid_bankruptcy: 1.0,
        maximize_total_assets: 0.4
      }
    };
  }

  async makeDecision(gameState, agent) {
    const { current_player, players, properties, board_position, dice_roll } = gameState;
    const strategy = this.strategies[agent.risk_profile] || this.strategies.balanced;

    // 1. Try Real AI Decision if configured
    if (agent.config && agent.config.ai_model && agent.config.api_key) {
      try {
        const aiDecision = await aiDecisionService.getDecision(gameState, agent);

        // Enhance with fallback score if not provided
        if (!aiDecision.score) aiDecision.score = aiDecision.confidence || 0.9;

        return aiDecision;
      } catch (aiError) {
        console.warn(`⚠️ Falling back to heuristic engine for ${agent.name} reason: ${aiError.message}`);
        // Fallback proceeds below...
      }
    }

    // 2. Fallback / Standard Heuristic Engine
    try {
      // Analyze current game situation
      const situationAnalysis = await this.analyzeGameSituation(gameState, agent);

      // Generate all possible actions
      const actions = await this.generatePossibleActions(gameState, agent);

      // Score each action using heuristic system
      const scoredActions = await this.scoreActions(actions, situationAnalysis, strategy);

      // Select best action
      const bestAction = scoredActions[0];

      // For complex decisions, use enhanced heuristic reasoning
      if (bestAction && bestAction.score < 0.7 && bestAction.type !== 'end_turn') {
        // Use actions instead of possibleActions
        const aiDecision = await this.getEnhancedHeuristicDecision(gameState, agent, actions);
        if (aiDecision) return aiDecision;
      }

      return bestAction;
    } catch (error) {
      console.error('Error in agent decision making:', error);
      return { type: 'end_turn', data: {}, confidence: 0.1, reasoning: "Error fallback" };
    }
  }

  async analyzeGameSituation(gameState, agent) {
    const { players, properties, current_player } = gameState;
    const currentPlayer = players.find(p => p.id === current_player.id);

    // Calculate financial situation
    const liquidity = currentPlayer.balance;
    const totalAssets = await this.calculateTotalAssets(currentPlayer, properties);
    const monthlyIncome = await this.calculateMonthlyIncome(currentPlayer, properties);

    // Analyze property ownership
    const ownedProperties = properties.filter(p => p.owner_id === currentPlayer.id);
    const colorGroups = this.analyzeColorGroups(ownedProperties);

    // Competition analysis
    const competitors = players.filter(p => p.id !== currentPlayer.id);
    const competitionStrength = competitors.reduce((acc, comp) => {
      return acc + (comp.balance / 1000); // Simplified strength metric
    }, 0);

    return {
      liquidity,
      totalAssets,
      monthlyIncome,
      ownedProperties: ownedProperties.length,
      colorGroups,
      competitionStrength,
      boardPosition: currentPlayer.position,
      isInJail: currentPlayer.is_in_jail,
      hasGetOutOfJailCard: currentPlayer.chance_jail_card || currentPlayer.community_chest_jail_card
    };
  }

  async generatePossibleActions(gameState, agent) {
    const { current_player, players, properties, board_position, dice_roll } = gameState;
    const currentPlayer = players.find(p => p.id === current_player.id);
    const actions = [];

    // Always can end turn
    actions.push({
      type: 'end_turn',
      data: {},
      baseScore: 0.1
    });

    // Check current position for property actions
    const currentProperty = properties.find(p => p.id === board_position);

    if (currentProperty) {
      // Buy property if available
      if (!currentProperty.owner_id && currentPlayer.balance >= currentProperty.price) {
        actions.push({
          type: 'buy_property',
          data: { property_id: currentProperty.id },
          baseScore: 0.5
        });
      }

      // Pay rent if owned by someone else
      if (currentProperty.owner_id && currentProperty.owner_id !== currentPlayer.id) {
        actions.push({
          type: 'pay_rent',
          data: { property_id: currentProperty.id },
          baseScore: 1.0 // Mandatory action
        });
      }
    }

    // Mortgage actions
    const ownedProperties = properties.filter(p => p.owner_id === currentPlayer.id);
    for (const property of ownedProperties) {
      if (!property.is_mortgaged) {
        actions.push({
          type: 'mortgage',
          data: { property_id: property.id },
          baseScore: 0.2
        });
      } else if (currentPlayer.balance >= property.mortgage_value * 1.1) {
        actions.push({
          type: 'unmortgage',
          data: { property_id: property.id },
          baseScore: 0.3
        });
      }
    }

    // Build houses/hotels
    const buildableProperties = this.getBuildableProperties(ownedProperties);
    for (const property of buildableProperties) {
      if (currentPlayer.balance >= property.house_price) {
        actions.push({
          type: 'build_house',
          data: { property_id: property.id },
          baseScore: 0.6
        });
      }

      if (property.houses === 4 && currentPlayer.balance >= property.hotel_price) {
        actions.push({
          type: 'build_hotel',
          data: { property_id: property.id },
          baseScore: 0.8
        });
      }
    }

    // Trade proposals (simplified)
    if (Math.random() < 0.1) { // 10% chance to consider trading
      actions.push({
        type: 'propose_trade',
        data: this.generateTradeProposal(currentPlayer, players, properties),
        baseScore: 0.2
      });
    }

    return actions;
  }

  async scoreActions(actions, situation, strategy) {
    const scoredActions = actions.map(action => {
      let score = action.baseScore;

      // Apply strategy weights
      switch (action.type) {
        case 'buy_property':
          score *= strategy.complete_color_groups;
          if (situation.liquidity < 200) score *= strategy.maintain_liquidity;
          break;

        case 'build_house':
        case 'build_hotel':
          score *= strategy.maximize_cashflow;
          if (situation.liquidity < 300) score *= strategy.maintain_liquidity;
          break;

        case 'mortgage':
          score *= strategy.maintain_liquidity;
          score *= (1 - strategy.avoid_bankruptcy);
          break;

        case 'unmortgage':
          score *= strategy.maximize_total_assets;
          break;

        case 'propose_trade':
          score *= strategy.complete_color_groups;
          break;

        case 'pay_rent':
          score = 1.0; // Always highest priority for mandatory actions
          break;

        case 'end_turn':
          score *= strategy.maintain_liquidity;
          break;
      }

      // Apply situational modifiers
      if (situation.liquidity < 100 && action.type !== 'mortgage') {
        score *= 0.5; // Low liquidity penalty
      }

      if (situation.isInJail && action.type === 'end_turn') {
        score *= 0.1; // Don't just end turn in jail
      }

      return {
        ...action,
        score,
        confidence: Math.min(score, 1.0)
      };
    });

    return scoredActions.sort((a, b) => b.score - a.score);
  }

  async getEnhancedHeuristicDecision(gameState, agent, possibleActions) {
    // Enhanced heuristic reasoning without external AI dependency
    const { current_player, players, properties } = gameState;
    const currentPlayer = players.find(p => p.id === current_player.id);

    // Complex decision logic based on game state
    let reasoning = `Agent ${agent.name} (${agent.risk_profile} strategy): `;

    // Analyze financial situation
    const liquidityRatio = currentPlayer.balance / 1500; // Starting balance reference
    const ownedProperties = properties.filter(p => p.owner_id === currentPlayer.id);
    const propertyRatio = ownedProperties.length / 28; // Total properties reference

    // Enhanced decision logic
    if (liquidityRatio < 0.2) {
      reasoning += "Low cash reserves, prioritizing liquidity preservation";
      // Prefer mortgage or conservative actions
      const conservativeActions = possibleActions.filter(a =>
        a.type === 'mortgage' || a.type === 'end_turn'
      );
      if (conservativeActions.length > 0) {
        const selected = conservativeActions[0];
        return {
          ...selected,
          reasoning,
          confidence: 0.8
        };
      }
    }

    if (propertyRatio > 0.5 && liquidityRatio > 0.5) {
      reasoning += "Strong position, focusing on development";
      // Prefer building actions
      const developmentActions = possibleActions.filter(a =>
        a.type === 'build_house' || a.type === 'build_hotel'
      );
      if (developmentActions.length > 0) {
        const selected = developmentActions[0];
        return {
          ...selected,
          reasoning,
          confidence: 0.7
        };
      }
    }

    if (agent.risk_profile === 'aggressive' && liquidityRatio > 0.3) {
      reasoning += "Aggressive strategy, seeking expansion opportunities";
      // Prefer buying and building
      const expansionActions = possibleActions.filter(a =>
        a.type === 'buy_property' || a.type === 'build_house'
      );
      if (expansionActions.length > 0) {
        const selected = expansionActions[0];
        return {
          ...selected,
          reasoning,
          confidence: 0.6
        };
      }
    }

    reasoning += "Using balanced approach based on current game state";

    // Prefer active actions over ending turn
    const activeActions = possibleActions.filter(a => a.type !== 'end_turn');
    if (activeActions.length > 0) {
      return activeActions[0];
    }

    return possibleActions[0]; // Fallback to top heuristic choice (likely end_turn if no active actions)
  }

  async calculateTotalAssets(player, properties) {
    const ownedProperties = properties.filter(p => p.owner_id === player.id);
    return ownedProperties.reduce((total, property) => {
      let value = property.price;
      if (property.houses) value += property.houses * property.house_price;
      if (property.hotels) value += property.hotels * property.hotel_price;
      return total + value;
    }, 0);
  }

  async calculateMonthlyIncome(player, properties) {
    const ownedProperties = properties.filter(p => p.owner_id === player.id);
    return ownedProperties.reduce((total, property) => {
      let rent = property.base_rent;
      if (property.houses) rent = property.rent_with_house * property.houses;
      if (property.hotels) rent = property.rent_with_hotel * property.hotels;
      return total + rent;
    }, 0);
  }

  analyzeColorGroups(properties) {
    const colorGroups = {};

    properties.forEach(property => {
      if (!colorGroups[property.color]) {
        colorGroups[property.color] = {
          total: 0,
          owned: 0,
          canBuild: false
        };
      }

      colorGroups[property.color].total++;
      if (property.owner_id) {
        colorGroups[property.color].owned++;
      }
    });

    // Check if any color groups are complete and can build
    Object.keys(colorGroups).forEach(color => {
      const group = colorGroups[color];
      group.canBuild = group.total === group.owned && group.total > 0;
    });

    return colorGroups;
  }

  getBuildableProperties(properties) {
    return properties.filter(property => {
      // Can build if property is owned, not mortgaged, and has complete color group
      return property.owner_id &&
        !property.is_mortgaged &&
        property.houses < 4 &&
        !property.hotels;
    });
  }

  generateTradeProposal(currentPlayer, players, properties) {
    // Simplified trade generation
    const otherPlayers = players.filter(p => p.id !== currentPlayer.id);
    const targetPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];

    if (!targetPlayer) return null;

    const myProperties = properties.filter(p => p.owner_id === currentPlayer.id);
    const theirProperties = properties.filter(p => p.owner_id === targetPlayer.id);

    if (myProperties.length === 0 || theirProperties.length === 0) return null;

    return {
      from_player_id: currentPlayer.id,
      to_player_id: targetPlayer.id,
      offer_properties: [myProperties[0].id],
      request_properties: [theirProperties[0].id],
      offer_cash: 0,
      request_cash: 0
    };
  }
}

export default AgentDecisionEngine;
