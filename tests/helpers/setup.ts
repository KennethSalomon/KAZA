import { beforeAll, afterAll } from 'vitest';
import { resetDatabase } from './supabase-test-client';

beforeAll(async () => {
  await resetDatabase();
}, 60000);

afterAll(async () => {
  await resetDatabase();
}, 30000);