/** Escape regex metacharacters so user-supplied search text is matched literally
 *  (prevents ReDoS / catastrophic backtracking and unintended pattern matches). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a case-insensitive "contains" regex from untrusted input, anchored in
 *  length so an empty/huge query can't turn into an expensive scan. */
export function safeSearchRegex(input: string): RegExp {
  return new RegExp(escapeRegex(input.slice(0, 64)), 'i');
}

/** Fields that must never leave the API in a user document. */
export const USER_PUBLIC_SELECT =
  '-passwordHash -refreshTokenId -emailVerifyToken -twoFactorSecret -passwordResetToken';
