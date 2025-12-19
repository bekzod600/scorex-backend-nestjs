// database/init-schema.ts
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

async function initSchema() {
  // Validate required environment variables
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    console.error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
    console.error(
      'Please create a .env file or set these environment variables.',
    );
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Connecting to database...');
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('Running schema...');
    await pool.query(schema);
    console.log('Schema initialized successfully!');
  } catch (error) {
    console.error('Error initializing schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void initSchema();
