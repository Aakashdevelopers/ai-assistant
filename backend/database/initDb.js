const fs = require('fs');
const path = require('path');
const { exec } = require('../config/database');

async function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await exec(sql);
        console.log('Database schema successfully initialized.');
    } catch (error) {
        console.error('Failed to initialize database schema:', error);
        throw error;
    }
}

if (require.main === module) {
    initDb().then(() => {
        console.log('Database setup complete.');
        process.exit(0);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = initDb;
