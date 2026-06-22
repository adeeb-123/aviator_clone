import { Types, ClientSession } from 'mongoose';
import { User } from '../models/User';
import { Transaction, TxType } from '../models/Transaction';
import { AppError } from '../utils/errors';

/**
 * Atomically adjust a user's balance and write a ledger entry.
 * For debits, the conditional update guarantees the balance never goes negative
 * (avoids race conditions across concurrent bets / cashouts).
 */
export async function adjustBalance(params: {
  userId: Types.ObjectId | string;
  amount: number; // signed
  type: TxType;
  description?: string;
  reference?: string;
  session?: ClientSession;
}): Promise<number> {
  const { userId, amount, type, description = '', reference, session } = params;

  const filter: Record<string, unknown> = { _id: userId };
  if (amount < 0) {
    // ensure sufficient funds
    filter.balance = { $gte: -amount };
  }

  const updated = await User.findOneAndUpdate(
    filter,
    { $inc: { balance: amount } },
    { new: true, session: session ?? undefined },
  );

  if (!updated) {
    throw new AppError('Insufficient balance', 400);
  }

  await Transaction.create(
    [
      {
        userId,
        type,
        amount,
        balanceAfter: updated.balance,
        description,
        reference,
      },
    ],
    { session: session ?? undefined },
  );

  return updated.balance;
}
