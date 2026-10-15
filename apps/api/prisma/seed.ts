import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info('No demo users or company data are seeded. Configure Firebase users and submit through the authenticated API.');
}

main().finally(async () => prisma.$disconnect());
