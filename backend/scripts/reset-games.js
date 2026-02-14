import db from '../config/database.js';

async function resetGames() {
    try {
        console.log('🔥 Deleting all Games and associated data...');

        // Disable foreign key checks to allow truncation
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');

        console.log('   - Truncating game_play_history...');
        await db('game_play_history').truncate();

        console.log('   - Truncating chats...');
        await db('chats').truncate();

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

        await db.raw('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ All games deleted successfully.');

    } catch (err) {
        console.error('❌ Failed to reset games:', err);
    } finally {
        process.exit(0);
    }
}

resetGames();
