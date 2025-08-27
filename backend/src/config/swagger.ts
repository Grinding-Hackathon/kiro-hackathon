import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Offline Blockchain Wallet API',
      version: '1.0.0',
      description: `
        RESTful API for the Offline Blockchain Wallet system that enables secure cryptocurrency transactions 
        in environments with limited or no internet connectivity. The system uses offline tokens, 
        cryptographic signatures, and Bluetooth communication for peer-to-peer transactions.
        
        ## Features
        - Wallet-based authentication using cryptographic signatures
        - Offline token purchase and redemption
        - Balance queries for both blockchain and offline tokens
        - Public key distribution for mobile clients
        - Comprehensive error handling and validation
        
        ## Authentication
        Most endpoints require authentication using JWT tokens obtained through wallet signature verification.
        Include the token in the Authorization header: \`Bearer <token>\`
      `,
      contact: {
        name: 'Offline Wallet Team',
        email: 'support@offlinewallet.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://${config.host}:${config.port}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.offlinewallet.com/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
            },
            error: {
              type: 'string',
              description: 'Error message (present when success is false)',
            },
            message: {
              type: 'string',
              description: 'Human-readable message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO timestamp of the response',
            },
          },
          required: ['success', 'timestamp'],
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code',
                  enum: [
                    'VALIDATION_ERROR',
                    'AUTHENTICATION_REQUIRED',
                    'AUTHORIZATION_FAILED',
                    'RESOURCE_NOT_FOUND',
                    'RATE_LIMIT_EXCEEDED',
                    'BLOCKCHAIN_ERROR',
                    'INSUFFICIENT_BALANCE',
                    'TOKEN_EXPIRED',
                    'TOKEN_ALREADY_SPENT',
                    'DOUBLE_SPENDING_DETECTED',
                    'INVALID_SIGNATURE',
                    'NETWORK_ERROR',
                    'TRANSACTION_FAILED',
                    'SYNC_ERROR',
                    'SECURITY_VIOLATION',
                    'INTERNAL_SERVER_ERROR'
                  ]
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                },
              },
              required: ['code', 'message'],
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for debugging',
            },
          },
          required: ['success', 'error', 'timestamp'],
        },
        WalletBalance: {
          type: 'object',
          properties: {
            walletId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique wallet identifier',
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Ethereum wallet address',
            },
            balances: {
              type: 'object',
              properties: {
                blockchain: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'number',
                      minimum: 0,
                      description: 'Blockchain balance amount',
                    },
                    currency: {
                      type: 'string',
                      description: 'Currency type',
                    },
                    lastUpdated: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
                offline: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'number',
                      minimum: 0,
                      description: 'Offline token balance amount',
                    },
                    tokenCount: {
                      type: 'integer',
                      minimum: 0,
                      description: 'Number of offline tokens',
                    },
                    lastUpdated: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
                pending: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'number',
                      minimum: 0,
                      description: 'Pending transaction amount',
                    },
                    transactionCount: {
                      type: 'integer',
                      minimum: 0,
                      description: 'Number of pending transactions',
                    },
                  },
                },
              },
            },
            totalBalance: {
              type: 'number',
              minimum: 0,
              description: 'Total balance across all sources',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique transaction identifier',
            },
            type: {
              type: 'string',
              enum: ['token_purchase', 'token_redemption', 'offline_transfer', 'blockchain_transfer'],
              description: 'Transaction type',
            },
            senderId: {
              type: 'string',
              format: 'uuid',
              description: 'Sender user ID',
            },
            receiverId: {
              type: 'string',
              format: 'uuid',
              description: 'Receiver user ID',
            },
            amount: {
              type: 'number',
              minimum: 0,
              description: 'Transaction amount',
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
              description: 'Transaction status',
            },
            blockchainTxHash: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{64}$',
              description: 'Blockchain transaction hash',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction completion timestamp',
            },
            metadata: {
              type: 'object',
              description: 'Additional transaction metadata',
            },
          },
        },
        OfflineToken: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique token identifier',
            },
            amount: {
              type: 'number',
              minimum: 0,
              description: 'Token amount',
            },
            signature: {
              type: 'string',
              description: 'Cryptographic signature',
            },
            ownerId: {
              type: 'string',
              format: 'uuid',
              description: 'Token owner user ID',
            },
            isSpent: {
              type: 'boolean',
              description: 'Whether token has been spent',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Token creation timestamp',
            },
          },
        },
        SecurityStatus: {
          type: 'object',
          properties: {
            overallStatus: {
              type: 'string',
              enum: ['healthy', 'warning', 'critical'],
              description: 'Overall security status',
            },
            securityScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Security score out of 100',
            },
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Alert identifier',
                  },
                  type: {
                    type: 'string',
                    enum: ['info', 'warning', 'error'],
                    description: 'Alert severity type',
                  },
                  message: {
                    type: 'string',
                    description: 'Alert message',
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Alert timestamp',
                  },
                },
              },
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Recommendation identifier',
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Recommendation priority',
                  },
                  title: {
                    type: 'string',
                    description: 'Recommendation title',
                  },
                  description: {
                    type: 'string',
                    description: 'Recommendation description',
                  },
                },
              },
            },
            lastSecurityScan: {
              type: 'string',
              format: 'date-time',
              description: 'Last security scan timestamp',
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request - Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Validation failed',
                details: [
                  {
                    field: 'amount',
                    message: 'Amount must be between 0.01 and 1,000,000',
                  },
                ],
                timestamp: '2025-01-28T10:30:00.000Z',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Invalid token',
                timestamp: '2025-01-28T10:30:00.000Z',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Internal server error',
                timestamp: '2025-01-28T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication using wallet signatures and session management',
      },
      {
        name: 'Wallet',
        description: 'Wallet operations, balance queries, and transaction history',
      },
      {
        name: 'Tokens',
        description: 'Token validation, division, and lifecycle management',
      },
      {
        name: 'Transactions',
        description: 'Transaction submission, synchronization, and status tracking',
      },
      {
        name: 'Security',
        description: 'Security monitoring, event reporting, and recommendations',
      },
      {
        name: 'Monitoring',
        description: 'System health checks and performance metrics',
      },
    ],
  },
  apis: [
    './src/controllers/*.ts',
    './src/routes/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
  `,
  customSiteTitle: 'Offline Wallet API Documentation',
  customfavIcon: '/favicon.ico',
};