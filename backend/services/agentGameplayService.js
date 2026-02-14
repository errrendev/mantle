import db from '../config/database.js';
import { approveTokenForAgent, createGameForAgent } from './agentTransactionService.js';
import { createPublicClient, http } from 'viem';

// Chain configuration for Monad Testnet
const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    network: 'monad-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'MON',
    },
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL] },
        public: { http: [process.env.MONAD_RPC_URL] },
    },
};

// ABI for reading game state
const GAME_READ_ABI = [
    {
        name: 'getGame',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'gameId', type: 'uint256' }],
        outputs: [{
            name: '',
            type: 'tuple',
            components: [
                { name: 'id', type: 'uint256' },
                { name: 'code', type: 'string' },
                { name: 'creator', type: 'address' },
                { name: 'status', type: 'uint8' },
                { name: 'winner', type: 'address' },
                { name: 'numberOfPlayers', type: 'uint8' },
                { name: 'joinedPlayers', type: 'uint8' },
                { name: 'mode', type: 'uint8' },
                { name: 'ai', type: 'bool' },
                { name: 'stakePerPlayer', type: 'uint256' },
                { name: 'totalStaked', type: 'uint256' },
                { name: 'createdAt', type: 'uint64' },
                { name: 'endedAt', type: 'uint64' },
            ]
        }]
    },
    {
        name: 'getGamePlayer',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'gameId', type: 'uint256' },
            { name: 'player', type: 'address' }
        ],
        outputs: [{
            name: '',
            type: 'tuple',
            components: [
                { name: 'gameId', type: 'uint256' },
                { name: 'playerAddress', type: 'address' },
                { name: 'balance', type: 'uint256' },
                { name: 'position', type: 'uint8' },
                { name: 'order', type: 'uint8' },
                { name: 'symbol', type: 'uint8' },
                { name: 'username', type: 'string' },
            ]
        }]
    },
];

/**
 * Get game state from blockchain
 */
async function getGameState(gameId) {
    const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL),
    });

    try {
        const game = await publicClient.readContract({
            address: process.env.TYCOON_CONTRACT_ADDRESS,
            abi: GAME_READ_ABI,
            functionName: 'getGame',
            args: [BigInt(gameId)],
        });

        return {
            id: game.id.toString(),
            code: game.code,
            creator: game.creator,
            status: Number(game.status), // 0=Pending, 1=Ongoing, 2=Ended
            winner: game.winner,
            numberOfPlayers: Number(game.numberOfPlayers),
            joinedPlayers: Number(game.joinedPlayers),
            mode: Number(game.mode),
            isAI: game.ai,
            stakePerPlayer: game.stakePerPlayer.toString(),
            totalStaked: game.totalStaked.toString(),
            createdAt: Number(game.createdAt),
            endedAt: Number(game.endedAt),
        };
    } catch (error) {
        console.error(`Error getting game state for game ${gameId}:`, error.message);
        return null;
    }
}

/**
 * Get player state in a game
 */
async function getPlayerState(gameId, playerAddress) {
    const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL),
    });

    try {
        const player = await publicClient.readContract({
            address: process.env.TYCOON_CONTRACT_ADDRESS,
            abi: GAME_READ_ABI,
            functionName: 'getGamePlayer',
            args: [BigInt(gameId), playerAddress],
        });

        return {
            gameId: player.gameId.toString(),
            playerAddress: player.playerAddress,
            balance: player.balance.toString(),
            position: Number(player.position),
            order: Number(player.order),
            symbol: Number(player.symbol),
            username: player.username,
        };
    } catch (error) {
        console.error(`Error getting player state:`, error.message);
        return null;
    }
}

/**
 * Get all active games for an agent
 */
async function getAgentActiveGames(agentId) {
    const games = await db('agent_games')
        .where({ agent_id: agentId })
        .whereIn('status', ['pending', 'active'])
        .orderBy('joined_at', 'desc');

    return games;
}

/**
 * Record agent joining a game
 */
async function recordGameJoin(agentId, gameId, gameCode, txHash) {
    const [id] = await db('agent_games').insert({
        agent_id: agentId,
        game_id: gameId,
        game_code: gameCode,
        status: 'pending',
        tx_hash_join: txHash,
    });

    return id;
}

/**
 * Update game status
 */
async function updateGameStatus(agentId, gameId, status, updates = {}) {
    await db('agent_games')
        .where({ agent_id: agentId, game_id: gameId })
        .update({
            status,
            ...updates,
            updated_at: db.fn.now(),
        });
}

/**
 * Log agent decision
 */
async function logDecision(agentId, gameId, decisionType, decisionData, reasoning) {
    const [id] = await db('agent_decisions').insert({
        agent_id: agentId,
        game_id: gameId,
        decision_type: decisionType,
        decision_data: JSON.stringify(decisionData),
        reasoning,
        executed: false,
    });

    return id;
}

/**
 * Mark decision as executed
 */
async function markDecisionExecuted(decisionId, txHash, error = null) {
    await db('agent_decisions')
        .where({ id: decisionId })
        .update({
            executed: !error,
            tx_hash: txHash,
            error_message: error,
            executed_at: db.fn.now(),
        });
}

/**
 * Get agent configuration
 */
async function getAgentConfig(agentId) {
    let config = await db('agent_config')
        .where({ agent_id: agentId })
        .first();

    // Create default config if doesn't exist
    if (!config) {
        await db('agent_config').insert({
            agent_id: agentId,
            auto_play_enabled: false,
            strategy: 'balanced',
            max_stake_per_game: 10,
            min_balance_threshold: 5,
            max_concurrent_games: 3,
            auto_join_games: false,
            preferred_game_type: 'PUBLIC',
        });

        config = await db('agent_config')
            .where({ agent_id: agentId })
            .first();
    }

    return config;
}

/**
 * Update agent configuration
 */
async function updateAgentConfig(agentId, updates) {
    await db('agent_config')
        .where({ agent_id: agentId })
        .update({
            ...updates,
            updated_at: db.fn.now(),
        });
}

/**
 * Auto-join available games or create new one
 */
async function autoJoinGame(agentId) {
    const config = await getAgentConfig(agentId);

    if (!config.auto_join_games) {
        return { success: false, message: 'Auto-join disabled' };
    }

    // Check if agent has room for more games
    const activeGames = await getAgentActiveGames(agentId);
    if (activeGames.length >= config.max_concurrent_games) {
        return { success: false, message: 'Max concurrent games reached' };
    }

    // Get agent details
    const agent = await db('agents').where({ id: agentId }).first();
    if (!agent) {
        return { success: false, message: 'Agent not found' };
    }

    try {
        // Get IDs of games agent is already in
        const activeGameIds = activeGames.map(g => g.game_id);

        // First, try to find existing waiting games
        const waitingGames = await db('games')
            .where('status', 'WAITING')
            .where('mode', config.preferred_game_type)
            .whereRaw('joined_players < number_of_players')
            .whereRaw('is_ai = ?', [config.preferred_game_type === 'AI'])
            .whereNotIn('id', activeGameIds) // Don't join games already in
            .orderBy('created_at', 'asc')
            .limit(5);

        // Filter by stake amount
        const affordableGames = waitingGames.filter(game => {
            const stakeAmount = parseFloat(game.stake_per_player || 0);
            return stakeAmount <= config.max_stake_per_game;
        });

        if (affordableGames.length > 0) {
            // Join the first affordable game
            const game = affordableGames[0];

            // Import joinGameForAgent dynamically to avoid circular dependency
            const { joinGameForAgent } = await import('./agentTransactionService.js');

            const result = await joinGameForAgent(agentId, {
                gameId: game.id,
                username: agent.name,
                playerSymbol: 'car', // TODO: Randomize or configure
                joinCode: game.code,
            });

            if (result.success) {
                await logDecision(agentId, game.id, 'join_game', {
                    gameCode: game.code,
                    stake: game.stake_per_player,
                }, `Joined existing game ${game.code}`);

                console.log(`🎮 Agent ${agent.name} joined game ${game.code}`);
            }

            return result;
        }

        // No suitable games found, create a new one
        const isAIGame = config.preferred_game_type === 'AI';

        const result = await createGameForAgent(agentId, {
            username: agent.name,
            gameType: config.preferred_game_type,
            playerSymbol: 'car',
            numberOfPlayers: 4,
            code: '',
            startingBalance: '1500',
            stakeAmount: '0',
            isAIGame: isAIGame,
        });

        if (result.success) {
            // Pass 0 or null for gameId since we don't have it yet
            await logDecision(agentId, 0, 'create_game', {
                gameType: config.preferred_game_type,
                players: 4,
                txHash: result.txHash
            }, `Created new AI game`);

            console.log(`🎮 Agent ${agent.name} created new game`);
        }

        return {
            ...result,
            message: result.success ? 'Game created successfully' : result.message,
        };
    } catch (error) {
        console.error('Error auto-joining game:', error);
        return { success: false, message: error.message };
    }
}


/**
 * Monitor and update game states
 */
async function monitorGames() {
    // Get all agents with active games
    const activeGames = await db('agent_games')
        .whereIn('status', ['pending', 'active'])
        .select('*');

    for (const agentGame of activeGames) {
        try {
            const gameState = await getGameState(agentGame.game_id);

            if (!gameState) continue;

            // Sync game state to database games table
            // This ensures auto-join can find detailed game info
            await db('games')
                .insert({
                    id: gameState.id,
                    code: gameState.code,
                    creator_id: 0, // Unknown from contract read, but required. Update if possible or ignore
                    status: gameState.status === 0 ? 'WAITING' : (gameState.status === 1 ? 'RUNNING' : 'COMPLETED'),
                    number_of_players: gameState.numberOfPlayers,
                    joined_players: gameState.joinedPlayers,
                    is_ai: gameState.ai,
                    mode: gameState.mode === 0 ? 'PUBLIC' : 'PRIVATE', // Assuming 0=PUBLIC
                    stake_per_player: (BigInt(gameState.stakePerPlayer) / BigInt(1e18)).toString(),
                    created_at: new Date(gameState.createdAt * 1000),
                })
                .onConflict('id')
                .merge({
                    status: gameState.status === 0 ? 'WAITING' : (gameState.status === 1 ? 'RUNNING' : 'COMPLETED'),
                    joined_players: gameState.joinedPlayers,
                    updated_at: db.fn.now(),
                });

            // Check if game has ended
            if (gameState.status === 2) { // Ended
                // Handle game completion (updates stats, records rank, etc.)
                await handleGameCompletion(agentGame.agent_id, agentGame.game_id);
                continue; // Skip further processing for completed games
            }

            // Update game status based on blockchain state
            if (gameState.status === 1) { // Ongoing
                if (agentGame.status === 'pending') {
                    await updateGameStatus(agentGame.agent_id, agentGame.game_id, 'active');
                }
            }

            // Get player state and update position/balance
            const agent = await db('agents')
                .where({ id: agentGame.agent_id })
                .first();

            if (agent && agent.wallet_address) {
                const playerState = await getPlayerState(agentGame.game_id, agent.wallet_address);

                if (playerState) {
                    await db('agent_games')
                        .where({ agent_id: agentGame.agent_id, game_id: agentGame.game_id })
                        .update({
                            position: playerState.position,
                            balance: parseFloat(playerState.balance) / 1e18,
                        });
                }
            }
        } catch (error) {
            console.error(`Error monitoring game ${agentGame.game_id}:`, error.message);
        }
    }
}

/**
 * Handle game completion - record results and update statistics
 */
async function handleGameCompletion(agentId, gameId) {
    try {
        const gameState = await getGameState(gameId);
        if (!gameState) return;

        const agent = await db('agents').where({ id: agentId }).first();
        if (!agent || !agent.wallet_address) return;

        const playerState = await getPlayerState(gameId, agent.wallet_address);
        if (!playerState) return;

        // Determine rank (simplified - would need to compare with other players)
        // For now, assume winner if balance is highest
        const rank = await determinePlayerRank(gameId, agent.wallet_address, gameState);

        // Calculate winnings (winner takes all in AI games)
        const winnings = rank === 1 ? parseFloat(gameState.totalStaked) / 1e18 : 0;

        // Update agent_games record
        await db('agent_games')
            .where({ agent_id: agentId, game_id: gameId })
            .update({
                status: 'completed',
                ended_at: new Date(),
                final_rank: rank,
                winnings: winnings,
                balance: parseFloat(playerState.balance) / 1e18,
            });

        // Update agent statistics
        await updateAgentStats(agentId, rank, winnings);

        // Log completion
        await logDecision(agentId, gameId, 'skip_turn', {
            event: 'game_completed',
            rank,
            winnings,
            finalBalance: parseFloat(playerState.balance) / 1e18,
        }, `Game completed with rank ${rank}, winnings: ${winnings}`);

        console.log(`✅ Game ${gameId} completed for agent ${agentId}: Rank ${rank}, Winnings ${winnings}`);
    } catch (error) {
        console.error(`Error handling game completion:`, error.message);
    }
}

/**
 * Determine player rank in completed game
 * Simplified: assumes rank 1 if game has winner and it's this player
 */
async function determinePlayerRank(gameId, playerAddress, gameState) {
    try {
        // If there's a winner address and it matches, rank 1
        if (gameState.winner && gameState.winner.toLowerCase() === playerAddress.toLowerCase()) {
            return 1;
        }

        // Otherwise, estimate based on final balance
        // TODO: Implement proper rank calculation by comparing all players
        const playerState = await getPlayerState(gameId, playerAddress);
        const balance = parseFloat(playerState.balance);

        // Simple heuristic: if balance > starting balance, likely top 2
        if (balance > 1500e18) return 2;
        if (balance > 1000e18) return 3;
        return 4;
    } catch (error) {
        console.error('Error determining rank:', error.message);
        return 4; // Default to last place on error
    }
}


/**
 * Update agent statistics after game completion
 */
async function updateAgentStats(agentId, rank, winnings) {
    try {
        const agent = await db('agents').where({ id: agentId }).first();
        if (!agent) return;

        const totalGames = (agent.total_matches || 0) + 1;
        const totalWins = (agent.total_wins || 0) + (rank === 1 ? 1 : 0);
        const totalRevenue = parseFloat(agent.total_revenue || 0) + parseFloat(winnings);
        const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

        // Update current streak
        let currentStreak = parseFloat(agent.current_streak || 0);
        if (rank === 1) {
            currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
        } else {
            currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
        }

        await db('agents')
            .where({ id: agentId })
            .update({
                total_matches: totalGames,
                total_wins: totalWins,
                total_revenue: totalRevenue,
                win_rate: winRate.toFixed(2),
                current_streak: currentStreak,
            });

        console.log(`📊 Updated stats for agent ${agentId}: ${totalWins}/${totalGames} wins (${winRate.toFixed(1)}%)`);
    } catch (error) {
        console.error('Error updating agent stats:', error.message);
    }
}

/**
 * Claim rewards for won games
 */
async function claimRewards(agentId) {
    try {
        // Get completed games where agent won but hasn't claimed
        const wonGames = await db('agent_games')
            .where({ agent_id: agentId, status: 'completed', final_rank: 1 })
            .whereNull('rewards_claimed_at')
            .select('game_id');

        if (wonGames.length === 0) {
            return { success: true, message: 'No rewards to claim' };
        }

        console.log(`🏆 Claiming rewards for ${wonGames.length} games for agent ${agentId}`);

        // Mark as claimed (actual claiming would happen on-chain)
        for (const { game_id } of wonGames) {
            await db('agent_games')
                .where({ agent_id: agentId, game_id })
                .update({ rewards_claimed_at: db.fn.now() });

            await logDecision(agentId, game_id, 'claim_rewards', {
                gameId: game_id,
            }, `Claimed rewards for game ${game_id}`);
        }

        return {
            success: true,
            claimedCount: wonGames.length,
            message: `Claimed rewards for ${wonGames.length} games`,
        };
    } catch (error) {
        console.error('Error claiming rewards:', error.message);
        return { success: false, message: error.message };
    }
}

export {
    getGameState,
    getPlayerState,
    getAgentActiveGames,
    recordGameJoin,
    updateGameStatus,
    logDecision,
    markDecisionExecuted,
    getAgentConfig,
    updateAgentConfig,
    autoJoinGame,
    monitorGames,
    handleGameCompletion,
    determinePlayerRank,
    updateAgentStats,
    claimRewards,
};
