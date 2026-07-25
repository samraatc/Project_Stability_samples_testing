import { describe, expect, it } from 'vitest';
import { getHealthStatus } from './health.service';

describe('health.service', () => {
  it('reports ok status with runtime metadata', () => {
    const health = getHealthStatus();

    expect(health.status).toBe('ok');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
  });

  it('reports database as disconnected when no connection is open', () => {
    const health = getHealthStatus();

    expect(health.database).toBe('disconnected');
  });
});
