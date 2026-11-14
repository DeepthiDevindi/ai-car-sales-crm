import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createLocalDevelopmentAccount, assertLocalDevelopmentEnvironment } from './development-bootstrap.service.js';
import { PasswordService } from './services/password.service.js';

const CONFIRMATION_PHRASE = 'CREATE LOCAL TEST ACCOUNT';

function loadLocalEnvironment(): void {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}

async function promptText(label: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(label)).trim();
  } finally {
    prompt.close();
  }
}

async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Password entry requires an interactive terminal.');
  }

  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('Local account bootstrap was cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  if (
    process.argv.length !== 3 ||
    process.argv[2] !== '--confirm-local-development'
  ) {
    throw new Error('Run this command only with --confirm-local-development.');
  }

  loadLocalEnvironment();
  assertLocalDevelopmentEnvironment(process.env.NODE_ENV, process.env.DATABASE_URL);
  if (!process.env.DEV_BOOTSTRAP_EMAIL_ALLOWLIST?.trim()) {
    throw new Error('Set DEV_BOOTSTRAP_EMAIL_ALLOWLIST in apps/api/.env before running bootstrap.');
  }

  const confirmation = await promptText(
    `Type "${CONFIRMATION_PHRASE}" to seed a local dealership, restricted staff role, and account: `,
  );
  if (confirmation !== CONFIRMATION_PHRASE) {
    throw new Error('The confirmation phrase did not match; no account was created.');
  }

  const email = await promptText('Authorized sign-in email: ');
  const password = await promptHidden('New password (hidden): ');
  const repeatedPassword = await promptHidden('Repeat password (hidden): ');
  if (password !== repeatedPassword) {
    throw new Error('The passwords did not match; no account was created.');
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    await createLocalDevelopmentAccount(
      prisma,
      new PasswordService(),
      {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL,
        allowlist: process.env.DEV_BOOTSTRAP_EMAIL_ALLOWLIST,
        email,
        password,
        confirmed: true,
      },
    );
    console.log('Local development account created with a restricted dealership role.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Local account bootstrap failed.');
  }
  process.exitCode = 1;
});
