import db from './config/database.js';

async function inspectGames() {
    try {
        console.log('\n--- Games Table Columns ---');
        const [columns] = await db.raw('SHOW COLUMNS FROM games');
        columns.forEach(col => console.log(`${col.Field}: ${col.Type}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectGames();
