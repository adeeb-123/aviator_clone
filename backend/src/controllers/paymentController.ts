import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { adjustBalance } from '../services/ledger';
import { asyncHandler } from '../middleware/error';
import { badRequest } from '../utils/errors';
import { logger } from '../utils/logger';

const stripe = env.stripeSecret ? new Stripe(env.stripeSecret) : null;

/**
 * Create a Stripe Checkout session (sandbox). The webhook credits the balance
 * once payment succeeds, so funds are never granted on the unverified client.
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
          currency: 'usd',
          product_data: { name: 'Aviator credits' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { userId: req.user!.sub, credits: String(amount) },
    success_url: `${env.frontendUrl}/wallet?status=success`,
    cancel_url: `${env.frontendUrl}/wallet?status=cancel`,
  });

  res.json({ url: session.url, sessionId: session.id });
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
    const credits = Number(session.metadata?.credits ?? 0);
    if (userId && credits > 0) {
      await adjustBalance({
        userId,
        amount: credits,
        type: 'deposit',
        description: 'Stripe deposit',
        reference: session.id,
      });
      logger.info({ userId, credits }, 'Stripe deposit credited');
    }
  }

  res.json({ received: true });
});

/** Withdraw simply debits the in-app balance (payout rails are out of scope for the sandbox). */
export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = req.body as { amount: number };
  const balance = await adjustBalance({
    userId: req.user!.sub,
    amount: -amount,
    type: 'withdraw',
    description: 'Withdrawal request',
  });
  res.json({ balance, message: 'Withdrawal queued' });
});
