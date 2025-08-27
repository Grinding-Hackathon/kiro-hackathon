import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add composite indexes for common query patterns
  await knex.schema.alterTable('transactions', (table) => {
    // Composite index for user transaction history queries
    table.index(['sender_id', 'created_at', 'status'], 'idx_transactions_sender_created_status');
    table.index(['receiver_id', 'created_at', 'status'], 'idx_transactions_receiver_created_status');
    
    // Index for balance calculations
    table.index(['sender_id', 'status', 'amount'], 'idx_transactions_sender_status_amount');
    table.index(['receiver_id', 'status', 'amount'], 'idx_transactions_receiver_status_amount');
    
    // Index for date range queries
    table.index(['created_at', 'type', 'status'], 'idx_transactions_created_type_status');
    
    // Index for blockchain transaction lookups
    table.index(['blockchain_tx_hash', 'status'], 'idx_transactions_blockchain_status');
  });

  await knex.schema.alterTable('offline_tokens', (table) => {
    // Composite index for token balance calculations
    table.index(['user_id', 'status', 'amount'], 'idx_tokens_user_status_amount');
    
    // Index for token expiration cleanup
    table.index(['expires_at', 'status'], 'idx_tokens_expires_status');
    
    // Index for token redemption queries
    table.index(['user_id', 'redeemed_at', 'status'], 'idx_tokens_user_redeemed_status');
    
    // Index for token spending queries
    table.index(['user_id', 'spent_at', 'status'], 'idx_tokens_user_spent_status');
  });

  await knex.schema.alterTable('users', (table) => {
    // Index for active user queries
    table.index(['is_active', 'created_at'], 'idx_users_active_created');
    
    // Index for wallet address lookups with status
    table.index(['wallet_address', 'is_active'], 'idx_users_wallet_active');
  });

  // Create partial indexes for better performance on filtered queries
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_active_sender 
    ON transactions (sender_id, created_at DESC) 
    WHERE status IN ('pending', 'completed')
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_active_receiver 
    ON transactions (receiver_id, created_at DESC) 
    WHERE status IN ('pending', 'completed')
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_active_user 
    ON offline_tokens (user_id, amount) 
    WHERE status = 'active' AND expires_at > NOW()
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_pending_expiration 
    ON offline_tokens (expires_at) 
    WHERE status = 'active'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop composite indexes
  await knex.schema.alterTable('transactions', (table) => {
    table.dropIndex([], 'idx_transactions_sender_created_status');
    table.dropIndex([], 'idx_transactions_receiver_created_status');
    table.dropIndex([], 'idx_transactions_sender_status_amount');
    table.dropIndex([], 'idx_transactions_receiver_status_amount');
    table.dropIndex([], 'idx_transactions_created_type_status');
    table.dropIndex([], 'idx_transactions_blockchain_status');
  });

  await knex.schema.alterTable('offline_tokens', (table) => {
    table.dropIndex([], 'idx_tokens_user_status_amount');
    table.dropIndex([], 'idx_tokens_expires_status');
    table.dropIndex([], 'idx_tokens_user_redeemed_status');
    table.dropIndex([], 'idx_tokens_user_spent_status');
  });

  await knex.schema.alterTable('users', (table) => {
    table.dropIndex([], 'idx_users_active_created');
    table.dropIndex([], 'idx_users_wallet_active');
  });

  // Drop partial indexes
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_active_sender');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_active_receiver');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_tokens_active_user');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_tokens_pending_expiration');
}