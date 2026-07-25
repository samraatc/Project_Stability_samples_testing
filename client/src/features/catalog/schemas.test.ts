import { describe, expect, it } from 'vitest';
import { batchFormSchema, sampleFormSchema } from './schemas';

const validSample = {
  productId: 'p1',
  batchId: 'b1',
  sectionId: 's1',
  stabilityType: 'long-term',
  manufacturingDate: '2026-01-15',
  expiryDate: '2028-01-15',
  chargingDate: '2026-02-01',
  quantity: 60,
  remarks: '',
};

describe('sampleFormSchema', () => {
  it('accepts a valid sample', () => {
    expect(sampleFormSchema.safeParse(validSample).success).toBe(true);
  });

  it('rejects expiry on or before manufacturing date', () => {
    const result = sampleFormSchema.safeParse({ ...validSample, expiryDate: '2026-01-15' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('expiryDate'))).toBe(true);
  });

  it('rejects charging before manufacturing date', () => {
    const result = sampleFormSchema.safeParse({ ...validSample, chargingDate: '2025-12-31' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('chargingDate'))).toBe(true);
  });

  it('rejects negative quantity', () => {
    expect(sampleFormSchema.safeParse({ ...validSample, quantity: -1 }).success).toBe(false);
  });
});

describe('batchFormSchema', () => {
  it('rejects expiry before manufacturing date', () => {
    const result = batchFormSchema.safeParse({
      batchCode: 'B1',
      productId: 'p1',
      manufacturingDate: '2026-01-15',
      expiryDate: '2025-01-15',
      notes: '',
    });
    expect(result.success).toBe(false);
  });
});
