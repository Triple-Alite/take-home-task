import 'dotenv/config';
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

type SeedAccount = {
  role: UserRole;
  envPrefix: 'SEED_USER_A' | 'SEED_USER_B';
  legacyUidEnv: 'APP_OWNER_UID' | 'APP_COLLABORATOR_UID';
};

const accounts: SeedAccount[] = [
  { role: 'USER_A', envPrefix: 'SEED_USER_A', legacyUidEnv: 'APP_OWNER_UID' },
  { role: 'USER_B', envPrefix: 'SEED_USER_B', legacyUidEnv: 'APP_COLLABORATOR_UID' }
];

function initializeFirebase() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    credential: serviceAccount
      ? cert(JSON.parse(serviceAccount) as Parameters<typeof cert>[0])
      : applicationDefault()
  });
}

async function getOrCreateFirebaseUser(account: SeedAccount): Promise<UserRecord> {
  const auth = getAuth(initializeFirebase());
  const email = process.env[`${account.envPrefix}_EMAIL`];
  const password = process.env[`${account.envPrefix}_PASSWORD`];
  const configuredUid = process.env[account.legacyUidEnv];

  if (Boolean(email) !== Boolean(password)) {
    throw new Error(`${account.envPrefix}_EMAIL and ${account.envPrefix}_PASSWORD must be configured together`);
  }

  if (email && password) {
    let user: UserRecord;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'auth/user-not-found') throw error;
      user = await auth.createUser({ email, password });
    }
    if (configuredUid && user.uid !== configuredUid) {
      throw new Error(`${account.envPrefix} Firebase UID does not match ${account.legacyUidEnv}`);
    }
    return user;
  }

  if (configuredUid) return auth.getUser(configuredUid);
  throw new Error(`Configure ${account.envPrefix}_EMAIL and ${account.envPrefix}_PASSWORD, or ${account.legacyUidEnv}`);
}

async function provision(account: SeedAccount): Promise<void> {
  const firebaseUser = await getOrCreateFirebaseUser(account);
  if (!firebaseUser.email) throw new Error(`${account.envPrefix} Firebase account must have an email address`);

  const existingByUid = await prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } });
  const existingByEmail = await prisma.user.findUnique({ where: { email: firebaseUser.email } });
  if (existingByUid || existingByEmail) {
    const existing = existingByUid ?? existingByEmail;
    if (
      !existing ||
      existing.firebaseUid !== firebaseUser.uid ||
      existing.email !== firebaseUser.email ||
      existing.role !== account.role ||
      !existing.isActive
    ) {
      throw new Error(`${account.envPrefix} conflicts with an existing internal user; resolve role provisioning explicitly`);
    }
    console.info(`${account.role} is already provisioned`);
    return;
  }

  await prisma.user.create({
    data: { firebaseUid: firebaseUser.uid, email: firebaseUser.email, role: account.role }
  });
  console.info(`${account.role} was provisioned`);
}

async function main(): Promise<void> {
  for (const account of accounts) await provision(account);
  const [owners, collaborators] = await Promise.all([
    prisma.user.findMany({ where: { role: 'USER_A', isActive: true }, take: 2 }),
    prisma.user.findMany({ where: { role: 'USER_B', isActive: true }, take: 2 })
  ]);
  if (owners.length !== 1 || collaborators.length !== 1) {
    throw new Error('Exactly one active USER_A and one active USER_B must be provisioned');
  }
  const owner = owners[0];
  const collaborator = collaborators[0];
  if (owner && collaborator) {
    await prisma.company.updateMany({
      where: { ownerUid: owner.firebaseUid, ownerId: null },
      data: { ownerId: owner.id, collaboratorId: collaborator.id }
    });
    await prisma.image.updateMany({
      where: { uploadedBy: collaborator.firebaseUid, uploadedById: null },
      data: { uploadedById: collaborator.id }
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(`User provisioning failed (${error instanceof Error ? error.name : 'unknown error'})`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
