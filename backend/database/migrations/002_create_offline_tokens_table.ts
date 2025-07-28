import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('offline_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.decimal('amount', 18, 8).notNullable();
    table.text('signature').notNullable();
    table.string('issuer_public_key').notNullable();
    table.timestamp('issued_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('redeemed_at').nullable();
    table.timestamp('spent_at').nullable();
    table.enum('status', ['active', 'spent', 'redeemed', 'expired']).defaultTo('active');
    table.json('metadata').nullable(); // For storing additional token data
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['user_id']);
    table.index(['status']);
    table.index(['expires_at']);
    table.index(['issued_at']);
    table.index(['redeemed_at']);
    table.index(['user_id', 'status']);
    table.index(['expires_at', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('offline_tokens');
}