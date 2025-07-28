import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sender_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('receiver_id').references('id').inTable('users').onDelete('SET NULL');
    table.decimal('amount', 18, 8).notNullable();
    table.enum('type', ['online', 'offline', 'token_purchase', 'token_redemption']).notNullable();
    table.enum('status', ['pending', 'completed', 'failed', 'cancelled']).defaultTo('pending');
    table.string('blockchain_tx_hash', 66).nullable();
    table.text('sender_signature').nullable();
    table.text('receiver_signature').nullable();
    table.json('token_ids').nullable(); // Array of token IDs used in transaction
    table.json('metadata').nullable(); // Additional transaction data
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    
    // Indexes for performance
    table.index(['sender_id']);
    table.index(['receiver_id']);
    table.index(['type']);
    table.index(['status']);
    table.index(['blockchain_tx_hash']);
    table.index(['created_at']);
    table.index(['completed_at']);
    table.index(['sender_id', 'type']);
    table.index(['receiver_id', 'type']);
    table.index(['status', 'type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('transactions');
}