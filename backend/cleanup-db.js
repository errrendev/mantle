import db from './config/database.js';

async function cleanupDb() {
    try {
        console.log('🧹 Cleaning up test game data...');

        // Delete agent games created during testing
        const count = await db('agent_games')
            .where('id', '>=', 27) // Adjusted ID range
            .del();

        // Delete games created during testing
        const gamesCount = await db('games')
            .where('id', '>=', 27)
            .del();

        console.log(`✅ Deleted ${count} agent_games entries`);
        console.log(`✅ Deleted ${gamesCount} games entries`);

    } catch (err) {
        console.error('❌ Failed to clean up DB:', err);
    } finally {
        process.exit(0);
    }
}

cleanupDb();
