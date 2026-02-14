import db from './config/database.js';

async function inspectConfig() {
    try {
        console.log('\n--- Agent_Config Table Columns ---');
        const [columns] = await db.raw('SHOW COLUMNS FROM agent_config');
        columns.forEach(col => console.log(`${col.Field}: ${col.Type}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectConfig();
