import db from './config/database.js';

async function inspectSchema() {
    try {
        const gamesCols = await db('games').columnInfo();
        console.log('--- Games Table Columns ---');
        console.log(Object.keys(gamesCols).join('\n'));

        const agentGamesCols = await db('agent_games').columnInfo();
        console.log('\n--- Agent_Games Table Columns ---');
        console.log(Object.keys(agentGamesCols).join('\n'));
    } catch (err) {
        console.error('Error inspecting schema:', err);
    } finally {
        process.exit(0);
    }
}

inspectSchema();
