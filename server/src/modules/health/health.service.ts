import mongoose from 'mongoose';

const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  database: string;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
  };
}
