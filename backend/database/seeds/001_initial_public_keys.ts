import { Knex } from 'knex';
import { config } from '../../src/config/config';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing entries
  await knex('public_keys').del();

  // Insert OTM public key
  await knex('public_keys').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      key_type: 'otm',
      identifier: 'system',
      public_key: config.otm.publicKey,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}