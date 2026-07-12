import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Transactional email. If SMTP is configured (SMTP_HOST + SMTP_USER) real mail is
 * sent; otherwise (local dev) the message is logged so verification / reset links
 * remain usable without a mail server. Never throws to the caller — a mail failure
 * must not break the request that triggered it.
 */
let transport: Transporter | null = null;
let resolved = false;

function getTransport(): Transporter | null {
  if (resolved) return transport;
  resolved = true;
  if (env.smtp.host && env.smtp.user) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transport;
}

const FROM = process.env.MAIL_FROM ?? env.smtp.user ?? 'Aviator <no-reply@aviator.local>';

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const t = getTransport();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, `[mailer:dev] ${opts.text ?? opts.html}`);
    return;
  }
  try {
    await t.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  } catch (err) {
    logger.error({ err, to: opts.to }, 'sendMail failed');
  }
}

export function verificationEmail(link: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Verify your Aviator account',
    text: `Verify your email: ${link}`,
    html: `<p>Welcome to Aviator! Confirm your email to activate your account:</p><p><a href="${link}">${link}</a></p>`,
  };
}

export function passwordResetEmail(link: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Reset your Aviator password',
    text: `Reset your password (valid 30 min): ${link}`,
    html: `<p>We received a request to reset your password. This link is valid for 30 minutes:</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, ignore this email.</p>`,
  };
}
