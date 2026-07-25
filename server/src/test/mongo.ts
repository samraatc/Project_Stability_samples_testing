import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Shared factory for test MongoDB instances. The generous launch timeout
 * absorbs slow cold starts (antivirus scans, loaded CI machines).
 */
export function startMemoryMongo(): Promise<MongoMemoryServer> {
  return MongoMemoryServer.create({
    instance: { launchTimeout: 60_000 },
  });
}
