import mongoose from 'mongoose';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { adjustBalance } from '../services/ledger';

async function seedUser(balance: number) {
  const user = new User({ username: `led${Date.now()}${Math.floor(balance)}`, email: `led${Math.random()}@ex.com`, referralCode: Math.random().toString(36).slice(2, 10) });
  await user.setPassword('Password123');
  user.balance = balance;
  await user.save();
  return user;
}

describe('ledger integrity', () => {
  it('debits and writes a matching ledger row', async () => {
    const user = await seedUser(100);
    const after = await adjustBalance({ userId: user._id, amount: -30, type: 'bet', description: 'x' });
    expect(after).toBe(70);
    const tx = await Transaction.findOne({ userId: user._id });
    expect(tx?.balanceAfter).toBe(70);
  });

  it('refuses a debit that would go negative', async () => {
    const user = await seedUser(50);
    await expect(adjustBalance({ userId: user._id, amount: -200, type: 'bet' })).rejects.toThrow(/insufficient/i);
    const fresh = await User.findById(user._id);
    expect(fresh?.balance).toBe(50);
  });

  it('stays race-safe under concurrent debits (no double-spend, no negative)', async () => {
    const user = await seedUser(100);
    // 10 concurrent debits of 20 against a 100 balance: at most 5 can succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => adjustBalance({ userId: user._id, amount: -20, type: 'bet' })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(5);
    const fresh = await User.findById(user._id);
    expect(fresh?.balance).toBe(0);
    expect(fresh!.balance).toBeGreaterThanOrEqual(0);
  });

  it('reverses the balance if the ledger write fails (no drift)', async () => {
    const user = await seedUser(100);
    const spy = jest.spyOn(Transaction, 'create').mockRejectedValueOnce(new Error('ledger down') as never);
    await expect(adjustBalance({ userId: user._id, amount: -40, type: 'bet' })).rejects.toThrow('ledger down');
    const fresh = await User.findById(user._id);
    expect(fresh?.balance).toBe(100); // compensated back
    spy.mockRestore();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) { /* setup handles teardown */ }
  });
});
