import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Standalone connectivity + schema check: `npm run db:verify`
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✔ connected to PostgreSQL');
    const counts = {
      users: await prisma.user.count(),
      sessions: await prisma.session.count(),
      interaction_events: await prisma.interactionEvent.count(),
      friction_history: await prisma.frictionHistory.count(),
    };
    console.log('✔ all four tables reachable, row counts:', counts);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error('✖ verification failed:', e.message);
  process.exit(1);
});
