import db from './config/database.js';

async function inspectAgents() {
    try {
        console.log('\n--- Agents Table Columns ---');
        const [columns] = await db.raw('SHOW COLUMNS FROM agents');
        columns.forEach(col => console.log(`${col.Field}: ${col.Type}`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectAgents();
