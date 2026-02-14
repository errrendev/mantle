import db from '../config/database.js';
import agentDecisionService from './agentDecisionService.js';
import gamePlayerController from '../controllers/gamePlayerController.js';
import gamePropertyController from '../controllers/gamePropertyController.js';
import { logDecision } from './agentGameplayService.js';

// Helper to mock Express req/res
const mockReqRes = (body, user) => {
    const req = {
        body,
        user: user || { id: body.user_id },
        app: { get: () => ({ to: () => ({ emit: () => { } }) }) } // Mock Socket.io
    };

    let responseData = null;
    const res = {
        status: (code) => res,
        json: (data) => {
            responseData = data;
            return res;
        }
    };

    return { req, res, getResponse: () => responseData };
};

/**
 * Check if it's the agent's turn in a game via DB
 */
async function isAgentTurn(gameId, agentUserId) {
    try {
        const game = await db('games').where({ id: gameId }).first();
        if (!game) return false;

        // Check if next_player_id matches agent's user ID
        return game.next_player_id === agentUserId;
    } catch (error) {
        console.error(`Error checking turn for game ${gameId}:`, error.message);
        return false;
    }
}

/**
 * Execute dice roll via Controller
 */
async function executeDiceRoll(agentId, gameId) {
    try {
        const agent = await db('agents').where({ id: agentId }).first();
        // Get agent's User ID (linked to agent)
        // Assuming agent.id maps to a User or we need to look up the User created for this Agent
        // For Phase 3.4, we treated Agent as User in some contexts, but gameController creates specific Users for AI.
        // We need to find the User record for this Agent in this Game.

        // Find GamePlayer for this agent in this game
        // We match by address because Agent has wallet_address
        const gamePlayer = await db('game_players')
            .where({ game_id: gameId })
            .whereRaw('LOWER(address) = ?', [agent.wallet_address.toLowerCase()])
            .first();

        if (!gamePlayer) {
            throw new Error(`Agent ${agent.name} is not a player in game ${gameId}`);
        }

        const userId = gamePlayer.user_id;

        // Simulate Roll Logic (Controller expects 'rolled' or generates it? 
        // gamePlayerController.changePosition uses 'rolled' from body if provided, otherwise?
        // Wait, changePosition expects 'rolled' to be provided! It doesn't roll dice itself?
        // Let's check frontend. Frontend rolls, then sends result.
        // So Agent must generate random roll here.

        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const rolled = die1 + die2;
        const isDouble = die1 === die2;
        const position = (gamePlayer.position + rolled) % 40; // Simple calc, controller handles jail/etc

        // Call Controller
        const { req, res, getResponse } = mockReqRes({
            game_id: gameId,
            user_id: userId,
            position: position,
            rolled: rolled,
            is_double: isDouble
        });

        await gamePlayerController.changePosition(req, res);
        const result = getResponse();

        if (!result || !result.success) {
            throw new Error(result?.message || 'Failed to execute move');
        }

        // Log decision
        // logDecision(agentId, gameId, decisionType, data, reasoning)
        await logDecision(agentId, gameId, 'roll_dice', {
            rolled,
            newPosition: result.data.new_position,
            rentPaid: result.data.rent_paid
        }, `Rolled ${rolled} (${die1}+${die2}), moved to ${result.data.new_position}`);

        console.log(`🎲 Agent ${agent.name} rolled ${rolled} in game ${gameId}`);

        // After moving, check for Buy Decision
        // The result.data.new_position is where we are.
        // We need to fetch the property at this position.
        await evaluatePostMove(agent, userId, gameId, result.data.new_position);

        return { success: true, rolled, newPosition: result.data.new_position };

    } catch (error) {
        console.error(`Error executing dice roll:`, error.message);
        return { success: false, message: error.message };
    }
}

/**
 * Evaluate actions after moving (Buy Property)
 */
async function evaluatePostMove(agent, userId, gameId, position) {
    try {
        // Fetch property at position
        const property = await db('properties').where({ id: position }).first();
        if (!property) return;

        // Check types that can be bought (not Chance, Tax, etc)
        // Group 0 usually unbuyable? 
        if (property.group_id === 0) return;

        // Check if owned
        const existing = await db('game_properties').where({ game_id: gameId, property_id: property.id }).first();
        if (existing) return; // Already owned

        // Check Affordability & Strategy
        const gamePlayer = await db('game_players').where({ user_id: userId, game_id: gameId }).first();
        const gameState = {
            gameId,
            myself: gamePlayer
        };

        const analysis = await agentDecisionService.shouldBuyProperty(agent, property, gameState);

        if (analysis.decision) {
            await executeBuyProperty(agent.id, userId, gameId, property.id, property.price);
        } else {
            await logDecision(agent.id, gameId, 'skip_purchase', {
                propertyId: property.id,
                reason: analysis.reason
            }, `Skipped ${property.name}`);
        }

    } catch (error) {
        console.error('Error evaluating post-move:', error);
    }
}

/**
 * Execute property purchase via Controller
 */
async function executeBuyProperty(agentId, userId, gameId, propertyId, price) {
    try {
        const { req, res, getResponse } = mockReqRes({
            game_id: gameId,
            user_id: userId,
            property_id: propertyId
        });

        await gamePropertyController.buy(req, res);
        const result = getResponse();

        if (!result || !result.success) {
            throw new Error(result?.message || 'Failed to buy property');
        }

        await logDecision(agentId, gameId, 'buy_property', {
            propertyId,
            price
        }, `Bought property ${propertyId}`);

        console.log(`🏠 Agent bought property ${propertyId}`);
        return { success: true };

    } catch (error) {
        console.error(`Error buying property:`, error.message);
        await logDecision(agentId, gameId, 'buy_error', { error: error.message }, 'Failed purchase');
        return { success: false, message: error.message };
    }
}

/**
 * Monitor agent's active games and execute turns
 */
async function monitorAgentTurns(agentId) {
    try {
        const agent = await db('agents').where({ id: agentId }).first();
        if (!agent) return;

        // Find active games where agent is a player
        // Agent's wallet address links to User -> links to GamePlayer
        const activeGames = await db('game_players')
            .join('games', 'game_players.game_id', 'games.id')
            .whereRaw('LOWER(game_players.address) = ?', [agent.wallet_address.toLowerCase()])
            .where('games.status', 'RUNNING')
            .select('games.id as game_id', 'game_players.user_id');

        if (activeGames.length === 0) {
            return { success: true, message: 'No active games' };
        }

        for (const game of activeGames) {
            const isTurn = await isAgentTurn(game.game_id, game.user_id);

            if (isTurn) {
                console.log(`🎮 It's Agent ${agent.name}'s turn in game ${game.game_id}`);
                await executeDiceRoll(agentId, game.game_id);
            }
        }

        return { success: true, message: 'Turn monitoring complete' };
    } catch (error) {
        console.error(`Error monitoring agent turns:`, error.message);
        return { success: false, message: error.message };
    }
}

export {
    isAgentTurn,
    executeDiceRoll,
    executeBuyProperty,
    monitorAgentTurns,
};
