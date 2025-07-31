import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'offline_wallet_'
});

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

const blockchainConnectionStatus = new promClient.Gauge({
  name: 'blockchain_connection_status',
  help: 'Status of blockchain connection (1 = connected, 0 = disconnected)',
  registers: [register]
});

const ethereumGasPrice = new promClient.Gauge({
  name: 'ethereum_gas_price_gwei',
  help: 'Current Ethereum gas price in gwei',
  registers: [register]
});

const offlineTokensTotal = new promClient.Counter({
  name: 'offline_tokens_total',
  help: 'Total number of offline tokens issued',
  labelNames: ['status'],
  registers: [register]
});

const offlineTokensExpired = new promClient.Counter({
  name: 'offline_tokens_expired_total',
  help: 'Total number of expired offline tokens',
  registers: [register]
});

const transactionProcessingDelay = new promClient.Gauge({
  name: 'transaction_processing_delay_seconds',
  help: 'Average transaction processing delay in seconds',
  registers: [register]
});

const securityEvents = new promClient.Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['type', 'severity'],
  registers: [register]
});

const authFailures = new promClient.Counter({
  name: 'auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['reason'],
  registers: [register]
});

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Increment active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    // Record metrics
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: res.statusCode
    });
    
    httpRequestDuration.observe({
      method: req.method,
      route,
      status: res.statusCode
    }, duration);
    
    // Decrement active connections
    activeConnections.dec();
  });
  
  next();
};

// Metrics endpoint handler
export const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
};

// Export metrics for use in other modules
export const metrics = {
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  blockchainConnectionStatus,
  ethereumGasPrice,
  offlineTokensTotal,
  offlineTokensExpired,
  transactionProcessingDelay,
  securityEvents,
  authFailures,
  register
};

// Helper functions to update business metrics
export const updateBlockchainStatus = (connected: boolean) => {
  blockchainConnectionStatus.set(connected ? 1 : 0);
};

export const updateGasPrice = (gasPriceGwei: number) => {
  ethereumGasPrice.set(gasPriceGwei);
};

export const recordOfflineToken = (status: 'issued' | 'redeemed' | 'expired') => {
  offlineTokensTotal.inc({ status });
};

export const recordTokenExpiration = () => {
  offlineTokensExpired.inc();
};

export const updateTransactionDelay = (delaySeconds: number) => {
  transactionProcessingDelay.set(delaySeconds);
};

export const recordSecurityEvent = (type: string, severity: 'low' | 'medium' | 'high' | 'critical') => {
  securityEvents.inc({ type, severity });
};

export const recordAuthFailure = (reason: string) => {
  authFailures.inc({ reason });
};