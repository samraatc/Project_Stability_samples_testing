import { describe, expect, it } from 'vitest';
import { hashPassword, passwordSchema, verifyPassword } from './password';

describe('passwordSchema (policy)', () => {
  it('accepts a compliant password', () => {
    expect(passwordSchema.safeParse('Str0ng!Passw0rd').success).toBe(true);
  });

  it.each([
    ['too short', 'Sh0rt!x'],
    ['no uppercase', 'weakpassw0rd!'],
    ['no lowercase', 'WEAKPASSW0RD!'],
    ['no digit', 'WeakPassword!'],
    ['no special character', 'WeakPassw0rd1'],
  ])('rejects password with %s', (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');

    expect(hash).not.toContain('Str0ng!Passw0rd');
    expect(await verifyPassword('Str0ng!Passw0rd', hash)).toBe(true);
    expect(await verifyPassword('Wrong!Passw0rd1', hash)).toBe(false);
  });
});
