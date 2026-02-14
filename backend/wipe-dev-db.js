import db from './config/database.js';

async function wipeDatabase() {
    try {
        console.log('🔥 Wiping all Game and Agent data...');

        // Disable foreign key checks to allow truncation
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');

        console.log('   - Truncating agent_decisions...');
        await db('agent_decisions').truncate();

        console.log('   - Truncating agent_games...');
        await db('agent_games').truncate();

        console.log('   - Truncating game_players...');
        await db('game_players').truncate();

        console.log('   - Truncating game_properties...');
        await db('game_properties').truncate();

        console.log('   - Truncating game_settings...');
        await db('game_settings').truncate();

        console.log('   - Truncating games...');
        await db('games').truncate();

        console.log('   - Truncating agents...');
        await db('agents').truncate();

        // Optional: user cleanup if needed, but risky if we mix real users. 
        // We'll leave users table populated to avoid deleting admin/real users.

        await db.raw('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Database wiped successfully (Agents & Games cleared).');

    } catch (err) {
        console.error('❌ Failed to wipe DB:', err);
    } finally {
        process.exit(0);
    }
}

wipeDatabase();
