/**
 * Who becomes an admin (teacher) without being made one in the dashboard: the addresses in
 * ADMIN_EMAILS (comma-separated). Only once the address is proven to be theirs (Google says it's
 * verified, or they used a reset link sent to it), so nobody can take admin by signing up first
 * with the teacher's address. Being removed from the list doesn't demote anyone: use the dashboard.
 */
import { normalizeEmail } from '../account-rules';

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return (process.env.ADMIN_EMAILS ?? '').split(/[,;\s]+/).map(normalizeEmail).includes(e);
}
