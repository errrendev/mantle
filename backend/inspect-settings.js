import db from './config/database.js';

async function inspectSettings() {
    try {
        console.log('\n--- Game_Settings Table Columns ---');
        const [columns] = await db.raw('SHOW COLUMNS FROM game_settings');
        columns.forEach(col => console.log(`${col.Field}: ${col.Type}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectSettings();
