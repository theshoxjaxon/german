/**
 * What the sign-up, log-in and password forms accept, as zod schemas. The same schemas run in
 * the browser (instant feedback) and on the server (the real check: a request can skip the
 * browser). Messages are English and shown through t(), so each one has an Uzbek entry.
 */
import { z } from 'zod';
import { cleanDisplayName, PASSWORD_MAX_BYTES, passwordBytes } from './account-rules';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .pipe(z.email({ error: 'Enter a valid email address.' }).max(254, 'Enter a valid email address.'));

/** A new password: 8+ characters, and short enough for bcrypt to read all of it. */
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine((p) => passwordBytes(p) <= PASSWORD_MAX_BYTES, 'That password is too long.');

const name = z
  .string()
  .transform(cleanDisplayName)
  .pipe(z.string().min(1, 'Enter your name.').max(40, 'Use at most 40 characters.'));

/** "Confirm password" must repeat "Password". Checked even when other fields have problems, so every error shows at once. */
const matching = <T extends z.ZodObject<{ password: z.ZodType<string>; confirm: z.ZodType<string> }>>(schema: T) =>
  schema.refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    error: 'Passwords don’t match.',
    when: (p) => {
      const v = p.value as { password?: unknown; confirm?: unknown } | undefined;
      return typeof v?.password === 'string' && typeof v.confirm === 'string' && v.confirm !== '';
    },
  });

const confirm = z.string().min(1, 'Type the password again.');

export const signupSchema = matching(z.object({ name, email, password: newPassword, confirm }));

/** Logging in checks only that something was typed: the old rules may differ from today's. */
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.').max(1000) });

export const forgotSchema = z.object({ email });

export const resetSchema = matching(z.object({ token: z.string().regex(/^[\w-]{20,200}$/), password: newPassword, confirm }));

export const changePasswordSchema = matching(z.object({ current: z.string().min(1, 'Enter your current password.'), password: newPassword, confirm }));

export type FieldErrors = Record<string, string>;

/** Parse form values; on failure, the first message for each field (keyed by its name). */
export function parseForm<S extends z.ZodType>(schema: S, values: unknown): { ok: true; data: z.output<S> } | { ok: false; fieldErrors: FieldErrors } {
  const r = schema.safeParse(values);
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of r.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return { ok: false, fieldErrors };
}

/** The text fields of a submitted form, as strings (a file or a missing field becomes ''). */
export function formValues(form: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => {
    const v = form.get(n);
    return [n, typeof v === 'string' ? v : ''];
  }));
}
