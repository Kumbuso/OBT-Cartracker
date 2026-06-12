import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

const pg = new EmbeddedPostgres({
  databaseDir: path.join(__dirname, '..', '.pgmigrate'),
  user: 'postgres',
  password: 'obt2026',
  port: 5434,
  persistent: false,
});

async function main() {
  console.log('Starting postgres to generate migration...');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('obt_migrate');

  const DB_URL = 'postgresql://postgres:obt2026@localhost:5434/obt_migrate';
  writeFileSync(path.join(__dirname, '..', '.env'), [
    `DATABASE_URL="${DB_URL}"`,
    `JWT_SECRET="placeholder"`,
    `JWT_REFRESH_SECRET="placeholder"`,
    `PORT=3000`,
    `NODE_ENV=development`,
    `CORS_ORIGIN="*"`,
  ].join('\n'));

  console.log('Generating migration...');
  execSync('npx prisma migrate dev --name init --skip-seed', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: DB_URL },
  });

  await pg.stop();
  console.log('Migration created. Cleaning up...');
  const { rmSync } = await import('fs');
  rmSync(path.join(__dirname, '..', '.pgmigrate'), { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
