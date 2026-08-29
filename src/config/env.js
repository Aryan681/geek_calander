const path = require('path');
const dotenv = require('dotenv');

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function validateEnv() {
  const errors = [];

  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;

  if (!databaseUrl && !(host && user && database)) {
    errors.push('Missing database connection settings. Provide DATABASE_URL or PGHOST, PGUSER, and PGDATABASE.');
  }

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error('Invalid environment configuration');
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    database: {
      connectionString: databaseUrl,
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT, 10) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'geek_calendar',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    tmdb: {
      apiKey: process.env.TMDB_API_KEY || '',
    },
    igdb: {
      clientId: process.env.IGDB_CLIENT_ID || '',
      clientSecret: process.env.IGDB_CLIENT_SECRET || '',
    },
  };
}

const config = validateEnv();

module.exports = config;
