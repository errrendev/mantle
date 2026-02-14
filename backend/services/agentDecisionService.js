import db from '../config/database.js';
import { sendLowBalanceAlert } from './emailService.js';

/**
 * Service to handle intelligent decision making for agents
 */
const agentDecisionService = {

    /**
     * Evaluate whether to buy a property
     * @param {Object} agent - The agent making the decision
     * @param {Object} property - The property to buy
     * @param {Object} gameState - Current game state (players, properties)
     * @returns {Object} - { decision: boolean, reason: string }
     */
    async shouldBuyProperty(agent, property, gameState) {
        try {
            const config = await this.getAgentConfig(agent.id);
            const strategy = config.strategy || 'balanced';

            // 1. Check Affordability
            const currentBalance = Number(gameState.myself.balance);
            const price = Number(property.price);

            if (currentBalance < price) {
                // Check if low balance alert is needed
                if (currentBalance < 100) { // Threshold for alert
                    // Fetch agent owner email
                    const agentData = await db('agents').where('id', agent.id).select('name', 'owner_email').first();
                    if (agentData && agentData.owner_email) {
                        // We don't await this to avoid blocking gameplay
                        sendLowBalanceAlert(agentData.owner_email, agentData.name, 'GAME_CASH', currentBalance).catch(console.error);
                    }
                }
                return { decision: false, reason: 'Insufficient funds' };
            }

            const balanceAfter = currentBalance - price;

            // 2. Strategy Logic
            let minReserve = 0;
            switch (strategy) {
                case 'conservative':
                    minReserve = 500; // Keep $500 buffer
                    break;
                case 'aggressive':
                    minReserve = 50;  // Spend almost everything
                    break;
                case 'balanced':
                default:
                    minReserve = 200;
                    break;
            }

            if (balanceAfter < minReserve) {
                // Determine if it's a critical buy (monopoly completion)
                const isCritical = await this.isMonopolyCompleter(agent.id, property, gameState.gameId);
                if (isCritical && strategy !== 'conservative') {
                    return { decision: true, reason: 'Risking low balance for Monopoly completion' };
                }
                return { decision: false, reason: `Saving cash (Reserve: ${minReserve})` };
            }

            // 3. Value Evaluation
            // Basic: Buy everything if affordable
            return { decision: true, reason: 'Property is affordable and fits strategy' };

        } catch (error) {
            console.error('Error in decision making:', error);
            return { decision: false, reason: 'Error in decision logic' };
        }
    },

    /**
     * Check if buying this property completes a color group
     */
    async isMonopolyCompleter(agentUserId, property, gameId) {
        // Get all properties in group
        const groupProps = await db('properties').where('group_id', property.group_id).select('id');
        const groupIds = groupProps.map(p => p.id);

        // Get owned properties in this group
        const owned = await db('game_properties')
            .join('game_players', 'game_properties.player_id', 'game_players.id')
            .where('game_properties.game_id', gameId)
            .where('game_players.user_id', agentUserId)
            .whereIn('game_properties.property_id', groupIds)
            .count('game_properties.id as count')
            .first();

        // If owned + 1 == total in group, then yes
        return Number(owned.count) + 1 === groupIds.length;
    },

    /**
     * Get agent config
     */
    async getAgentConfig(agentId) {
        return await db('agent_config').where('agent_id', agentId).first() || {};
    }
};

export default agentDecisionService;
