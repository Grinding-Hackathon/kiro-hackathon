import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('public_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key_type').notNullable(); // 'user', 'otm', 'system'
    table.string('identifier').notNullable(); // wallet_address or system identifier
    table.text('public_key').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
    
    // Unique constraint on type and identifier
    table.unique(['key_type', 'identifier']);
    
    // Indexes for performance
    table.index(['key_type']);
    table.index(['identifier']);
    table.index(['is_active']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('public_keys');
}