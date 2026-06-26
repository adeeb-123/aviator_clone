import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { adjustBalance } from '../services/ledger';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { asyncHandler } from '../middleware/error';
import { badRequest, forbidden } from '../utils/errors';
import { logger } from '../utils/logger';

const stripe = env.stripeSecret ? new Stripe(env.stripeSecret) : null;

/** Credit a Stripe deposit exactly once (idempotent on the session id). */
async function creditDepositOnce(userId: string, credits: number, sessionId: string) {
  if (!(credits > 0)) return { credited: false as const };
  const existing = await Transaction.findOne({ reference: sessionId, type: 'deposit' }).lean();
  if (existing) {
    const u = await User.findById(userId).select('balance').lean();
    return { credited: false as const, already: true as const, balance: u?.balance ?? 0 };
  }
  const balance = await adjustBalance({
    userId,
    amount: credits,
    type: 'deposit',
    description: 'Stripe deposit',
    reference: sessionId,
  });
  logger.info({ userId, credits, sessionId }, 'Stripe deposit credited');
  return { credited: true as const, amount: credits, balance };
}

/**
 * Create a Stripe Checkout session. The balance is credited either by the webhook
 * (production) OR by /confirm when the user returns (works on localhost where the
 * webhook can't reach the server). Both paths are idempotent on the session id.
 */
export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  if (!stripe) throw badRequest('Stripe not configured');
  const { amount } = req.body as { amount: number };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: { name: 'Aviator credits' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { userId: req.user!.sub, credits: String(amount) },
    success_url: `${env.frontendUrl}/wallet?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.frontendUrl}/wallet?status=cancel`,
  });

  res.json({ url: session.url, sessionId: session.id });
});

/**
 * Confirm a deposit after the user returns from Checkout. Verifies the payment
 * with Stripe (so it can't be faked) and credits once. Lets deposits work locally
 * without a public webhook endpoint.
 */
export const confirmCheckout = asyncHandler(async (req: Request, res: Response) => {
  if (!stripe) throw badRequest('Stripe not configured');
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) throw badRequest('Missing sessionId');

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') {
    return res.json({ credited: false, status: session.payment_status });
  }
  if (session.metadata?.userId !== req.user!.sub) throw forbidden('This payment is not yours');

  const result = await creditDepositOnce(req.user!.sub, Number(session.metadata?.credits ?? 0), sessionId);
  res.json(result);
});

/** Stripe webhook — must receive the raw body (configured in index.ts). */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  if (!stripe) return res.status(400).end();
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) await creditDepositOnce(userId, Number(session.metadata?.credits ?? 0), session.id);
  }

  res.json({ received: true });
});

/** Withdraw instantly debits the in-app balance (no real payout rails in the sandbox). */
export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = req.body as { amount: number };
  const balance = await adjustBalance({
    userId: req.user!.sub,
    amount: -amount,
    type: 'withdraw',
    description: 'Withdrawal',
  });
  res.json({ balance, message: `Withdrew ₹${amount.toFixed(2)}` });
});
