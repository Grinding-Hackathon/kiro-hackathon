import dotenv from 'dotenv';

dotenv.config();

interface Config {
  env: string;
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  blockchain: {
    network: string;
    rpcUrl: string;
    privateKey: string;
    contractAddress?: string | undefined;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret?: string | undefined;
    refreshExpiresIn?: string;
  };
  otm: {
    privateKey: string;
    publicKey: string;
    tokenExpirationDays: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
  security: {
    bcryptRounds: number;
  };
  cors: {
    origin: string;
  };
  monitoring: {
    healthCheckInterval: number;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
}

const requiredEnvVars = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'ETHEREUM_RPC_URL',
  'OTM_PRIVATE_KEY',
  'OTM_PUBLIC_KEY',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config: Config = {
  env: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
  host: process.env['HOST'] || 'localhost',
  
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    name: process.env['DB_NAME'] || 'offline_wallet_db',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD']!,
    ssl: process.env['DB_SSL'] === 'true',
  },
  
  blockchain: {
    network: process.env['ETHEREUM_NETWORK'] || 'goerli',
    rpcUrl: process.env['ETHEREUM_RPC_URL']!,
    privateKey: process.env['PRIVATE_KEY'] || '',
    contractAddress: process.env['CONTRACT_ADDRESS'] || undefined,
  },
  
  jwt: {
    secret: process.env['JWT_SECRET']!,
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || undefined,
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  },
  
  otm: {
    privateKey: process.env['OTM_PRIVATE_KEY']!,
    publicKey: process.env['OTM_PUBLIC_KEY']!,
    tokenExpirationDays: parseInt(process.env['TOKEN_EXPIRATION_DAYS'] || '30', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  },
  
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    file: process.env['LOG_FILE'] || 'logs/app.log',
  },
  
  security: {
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
  },
  
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  },
  
  monitoring: {
    healthCheckInterval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '30000', 10),
  },
  
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || '',
    db: parseInt(process.env['REDIS_DB'] || '0', 10),
  },
};