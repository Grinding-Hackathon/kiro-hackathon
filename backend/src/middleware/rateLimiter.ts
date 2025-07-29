import rateLimit from 'express-rate-limit';
// import slowDown from 'express-slow-down'; // Commented out as package not installed
import { Request, Response } from 'express';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';

// Create rate limiter middleware
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP',
    message: `Please try again after ${config.rateLimit.windowMs / 60000} minutes`,
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again after ${config.rateLimit.windowMs / 60000} minutes.`,
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again after 15 minutes.',
      retryAfter: 900,
    });
  },
});

// Rate limiter for token operations (more restrictive)
export const tokenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 token operations per minute
  message: {
    error: 'Too many token operations',
    message: 'Please try again after 1 minute',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Token rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    });
    
    res.status(429).json({
      error: 'Too many token operations',
      message: 'Please try again after 1 minute.',
      retryAfter: 60,
    });
  },
});

// Progressive delay middleware for DDoS protection (simplified implementation)
export const progressiveDelay = (req: Request, _res: Response, next: Function) => {
  // Simple implementation without express-slow-down dependency
  const ip = req.ip || 'unknown';
  const now = Date.now();
  
  // Track request times per IP
  if (!ddosPatterns.rapidRequests.has(ip)) {
    ddosPatterns.rapidRequests.set(ip, []);
  }
  
  const requestTimes = ddosPatterns.rapidRequests.get(ip)!;
  const recentRequests = requestTimes.filter(time => now - time < 15 * 60 * 1000); // 15 minutes
  
  if (recentRequests.length > 5) {
    const delay = Math.min((recentRequests.length - 5) * 500, 20000); // Max 20 seconds
    
    logger.warn(`Progressive delay applied for IP: ${ip}`, {
      ip,
      delay,
      recentRequests: recentRequests.length,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    });
    
    setTimeout(() => next(), delay);
  } else {
    next();
  }
};

// Aggressive rate limiter for suspected attacks
export const aggressiveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Only 3 requests per minute
  message: {
    error: 'Suspicious activity detected',
    message: 'Your IP has been temporarily restricted due to suspicious activity',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.error(`Aggressive rate limit triggered for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
    
    res.status(429).json({
      error: 'Suspicious activity detected',
      message: 'Your IP has been temporarily restricted due to suspicious activity.',
      retryAfter: 60,
    });
  },
});

// IP-based tracking for suspicious behavior
const suspiciousIPs = new Map<string, { count: number; lastSeen: Date; blocked: boolean }>();
const blockedIPs = new Set<string>();

// DDoS protection patterns
const ddosPatterns = {
  rapidRequests: new Map<string, number[]>(), // IP -> timestamps
  largePayloads: new Map<string, number>(), // IP -> payload size count
  repeatedPaths: new Map<string, Map<string, number>>(), // IP -> path -> count
};

export const trackSuspiciousActivity = (req: Request, res: Response, next: Function) => {
  const ip = req.ip || 'unknown';
  const now = new Date();
  const timestamp = now.getTime();
  
  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    logger.error(`Blocked IP attempted access: ${ip}`, {
      ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP has been blocked due to suspicious activity',
    });
  }
  
  // Clean old entries (older than 1 hour)
  for (const [trackedIp, data] of suspiciousIPs.entries()) {
    if (timestamp - data.lastSeen.getTime() > 60 * 60 * 1000) {
      suspiciousIPs.delete(trackedIp);
      ddosPatterns.rapidRequests.delete(trackedIp);
      ddosPatterns.largePayloads.delete(trackedIp);
      ddosPatterns.repeatedPaths.delete(trackedIp);
    }
  }
  
  // Track rapid requests (DDoS detection)
  if (!ddosPatterns.rapidRequests.has(ip)) {
    ddosPatterns.rapidRequests.set(ip, []);
  }
  const requestTimes = ddosPatterns.rapidRequests.get(ip)!;
  requestTimes.push(timestamp);
  
  // Keep only requests from last 60 seconds
  const oneMinuteAgo = timestamp - 60 * 1000;
  ddosPatterns.rapidRequests.set(ip, requestTimes.filter(time => time > oneMinuteAgo));
  
  // Check for DDoS patterns
  const recentRequests = ddosPatterns.rapidRequests.get(ip)!.length;
  if (recentRequests > 100) { // More than 100 requests per minute
    blockIP(ip, 'DDoS pattern detected');
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Your IP has been temporarily blocked due to excessive requests',
    });
  }
  
  // Track large payloads
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    const largePayloadCount = (ddosPatterns.largePayloads.get(ip) || 0) + 1;
    ddosPatterns.largePayloads.set(ip, largePayloadCount);
    
    if (largePayloadCount > 5) { // More than 5 large payloads
      blockIP(ip, 'Large payload abuse');
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Your IP has been blocked due to excessive large requests',
      });
    }
  }
  
  // Track repeated path access
  if (!ddosPatterns.repeatedPaths.has(ip)) {
    ddosPatterns.repeatedPaths.set(ip, new Map());
  }
  const pathCounts = ddosPatterns.repeatedPaths.get(ip)!;
  const currentPathCount = (pathCounts.get(req.path) || 0) + 1;
  pathCounts.set(req.path, currentPathCount);
  
  if (currentPathCount > 50) { // More than 50 requests to same path per hour
    logger.warn(`Repeated path access detected: ${ip} -> ${req.path}`, {
      ip,
      path: req.path,
      count: currentPathCount,
    });
  }
  
  // Check for suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const isSuspicious = 
    !userAgent || 
    userAgent.length < 10 ||
    userAgent.includes('bot') || 
    userAgent.includes('crawler') ||
    userAgent.includes('scanner') ||
    req.url.includes('..') ||
    req.url.includes('<script>') ||
    req.url.includes('union select') ||
    req.url.includes('drop table') ||
    (req.body && JSON.stringify(req.body).includes('<script>')) ||
    (req.body && JSON.stringify(req.body).includes('union select'));
  
  if (isSuspicious) {
    const entry = suspiciousIPs.get(ip) || { count: 0, lastSeen: now, blocked: false };
    entry.count++;
    entry.lastSeen = now;
    suspiciousIPs.set(ip, entry);
    
    logger.warn(`Suspicious activity detected from IP: ${ip}`, {
      ip,
      userAgent,
      url: req.url,
      method: req.method,
      suspiciousCount: entry.count,
      contentLength,
    });
    
    // Block IP after repeated suspicious activity
    if (entry.count > 10) {
      blockIP(ip, 'Repeated suspicious activity');
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP has been blocked due to suspicious activity',
      });
    }
    
    // Apply aggressive rate limiting for repeated suspicious activity
    if (entry.count > 3) {
      return aggressiveRateLimiter(req, res, next as any);
    }
  }
  
  next();
};

// Block IP temporarily
function blockIP(ip: string, reason: string): void {
  blockedIPs.add(ip);
  
  logger.error(`IP blocked: ${ip}`, { ip, reason });
  
  // Unblock after 1 hour
  setTimeout(() => {
    blockedIPs.delete(ip);
    logger.info(`IP unblocked: ${ip}`, { ip });
  }, 60 * 60 * 1000);
}

// Enhanced DDoS protection middleware
export const ddosProtection = (req: Request, res: Response, next: Function) => {
  const ip = req.ip || 'unknown';
  const userAgent = req.get('User-Agent') || '';
  const contentLength = parseInt(req.get('content-length') || '0');
  
  // Block requests with no user agent
  if (!userAgent) {
    logger.warn(`Request with no user agent blocked: ${ip}`, { ip, url: req.url });
    return res.status(400).json({
      error: 'Bad request',
      message: 'User agent required',
    });
  }
  
  // Block extremely large requests
  if (contentLength > 50 * 1024 * 1024) { // 50MB
    logger.warn(`Extremely large request blocked: ${ip}`, { ip, contentLength });
    return res.status(413).json({
      error: 'Payload too large',
      message: 'Request payload exceeds maximum allowed size',
    });
  }
  
  // Block requests with suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-originating-ip',
    'x-remote-ip',
    'x-client-ip',
  ];
  
  let suspiciousHeaderCount = 0;
  for (const header of suspiciousHeaders) {
    if (req.get(header)) {
      suspiciousHeaderCount++;
    }
  }
  
  if (suspiciousHeaderCount > 2) {
    logger.warn(`Request with suspicious headers blocked: ${ip}`, {
      ip,
      suspiciousHeaderCount,
      headers: Object.keys(req.headers),
    });
    return res.status(400).json({
      error: 'Bad request',
      message: 'Suspicious request headers detected',
    });
  }
  
  return next();
};

// Get current security metrics
export const getSecurityMetrics = () => {
  return {
    blockedIPs: Array.from(blockedIPs),
    suspiciousIPs: Array.from(suspiciousIPs.entries()).map(([ip, data]) => ({
      ip,
      count: data.count,
      lastSeen: data.lastSeen,
      blocked: data.blocked,
    })),
    ddosPatterns: {
      rapidRequests: Array.from(ddosPatterns.rapidRequests.entries()).map(([ip, times]) => ({
        ip,
        requestCount: times.length,
        lastRequest: new Date(Math.max(...times)),
      })),
      largePayloads: Array.from(ddosPatterns.largePayloads.entries()).map(([ip, count]) => ({
        ip,
        largePayloadCount: count,
      })),
      repeatedPaths: Array.from(ddosPatterns.repeatedPaths.entries()).map(([ip, paths]) => ({
        ip,
        paths: Array.from(paths.entries()).map(([path, count]) => ({ path, count })),
      })),
    },
  };
};