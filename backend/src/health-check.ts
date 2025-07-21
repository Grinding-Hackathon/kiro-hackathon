#!/usr/bin/env node

/**
 * Health check script for Docker container
 * This script is used by Docker's HEALTHCHECK instruction
 */

import http from 'http';
import { config } from './config/config';

const options = {
  hostname: 'localhost',
  port: config.port,
  path: '/health',
  method: 'GET',
  timeout: 3000,
};

const healthCheck = (): void => {
  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      process.exit(0); // Success
    } else {
      console.error(`Health check failed with status: ${res.statusCode}`);
      process.exit(1); // Failure
    }
  });

  req.on('error', (error) => {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1); // Failure
  });

  req.on('timeout', () => {
    console.error('Health check timed out');
    req.destroy();
    process.exit(1); // Failure
  });

  req.setTimeout(options.timeout);
  req.end();
};

healthCheck();