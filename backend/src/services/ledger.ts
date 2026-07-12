import { Types, ClientSession } from 'mongoose';
import { User } from '../models/User';
import { Transaction, TxType } from '../models/Transaction';
import { alertBalanceEvent } from './alertService';
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

  try {
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
  } catch (err) {
    // The balance already moved but the ledger row failed to write. Inside a
    // transaction the caller's session rolls both back; without one, reverse the
    // $inc here so balance and ledger never drift apart (money integrity > liveness).
    if (!session) {
      await User.updateOne({ _id: userId }, { $inc: { balance: -amount } });
    }
    throw err;
  }

  // Operator alerts (fire-and-forget): high-balance crossing, large withdrawal/deposit.
  alertBalanceEvent({
    userId: String(userId),
    username: updated.username,
    type,
    amount,
    prevBalance: updated.balance - amount,
    newBalance: updated.balance,
  });

  return updated.balance;
}
