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
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                  },
                  message: {
                    type: 'string',
                  },
                },
              },
              description: 'Validation error details (if applicable)',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['success', 'error', 'timestamp'],
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
        description: 'User authentication using wallet signatures',
      },
      {
        name: 'Wallet',
        description: 'Wallet operations and token management',
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