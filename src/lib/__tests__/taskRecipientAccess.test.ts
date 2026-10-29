import { describe, expect, it } from 'vitest';
import { isCarolRecipient } from '../taskRecipientAccess';
import type { User } from '@/types';

const person = (username: string, overrides: Partial<User> = {}): User => ({
  id: 'emp-carol',
  name: 'Carol',
  username,
  role: 'employee',
  sectors: [],
  active: true,
  ...overrides,
});

describe('destinataria Carol', () => {
  it('reconhece username legado com sufixo e variacoes de caixa', () => {
    expect(isCarolRecipient(person('carol'))).toBe(true);
    expect(isCarolRecipient(person(' CAROL__ '))).toBe(true);
  });
  it('nao abre a excecao a outros usuarios, administradores ou contas inativas', () => {
    expect(isCarolRecipient(person('patricia'))).toBe(false);
    expect(isCarolRecipient(person('carolina'))).toBe(false);
    expect(isCarolRecipient(person('carol', { active: false }))).toBe(false);
    expect(isCarolRecipient(person('carol', { role: 'admin' }))).toBe(false);
  });
});
