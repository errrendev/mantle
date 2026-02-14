import db from './config/database.js';

async function runMigration() {
    try {
        console.log('Running migration to add missing columns...');

        // Check if joined_players exists
        const gamesCols = await db('games').columnInfo();
        if (!gamesCols.joined_players) {
            await db.schema.table('games', table => {
                table.integer('joined_players').defaultTo(0);
            });
            console.log('Added joined_players to games table');
        } else {
            console.log('joined_players already exists in games table');
        }

        // Check if rewards_claimed_at exists
        const agentGamesCols = await db('agent_games').columnInfo();
        if (!agentGamesCols.rewards_claimed_at) {
            await db.schema.table('agent_games', table => {
                table.timestamp('rewards_claimed_at').nullable();
            });
            console.log('Added rewards_claimed_at to agent_games table');
        } else {
            console.log('rewards_claimed_at already exists in agent_games table');
        }

        console.log('Migration complete');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

runMigration();
