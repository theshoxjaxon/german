import { Injectable, Logger } from '@nestjs/common';
import { cleanDisplayName, normalizeEmail, safeNext } from '@/lib/account-rules';
import { changePasswordSchema, forgotSchema, loginSchema, parseForm, resetSchema, signupSchema } from '@/lib/auth-schemas';
import { VISITOR_RE } from '@/lib/text';
import { HOUR, MIN } from '@/lib/time';
import type { UiLang } from '@/lib/types';
import { after } from '@api/common/after';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '@api/common/password';
import { RateLimiter } from '@api/common/rate-limit.service';
import { CourseChoiceService } from '@api/courses/course-choice.service';
import { describeDbError } from '@api/database/db-health';
import { CONFIRM_HOURS, MailService, RESET_MINUTES } from '@api/mail/mail.service';
import { UsersRepository, type UserRow } from '@api/users/users.repository';
import { AuthRepository } from './auth.repository';
import { SessionService } from './session.service';

/** What a form shows after it is sent: the same shape the web forms already read. */
export interface FormState {
  error?: string;
  /** Sign-up done: the address a confirmation link was sent to. */
  sent?: string;
  /** Log-in refused because this address still has to be confirmed. */
  unconfirmed?: string;
  success?: string;
  fields?: Record<string, string>;
  fieldErrors?: Record<string, string>;
  /** Done: where to go next. */
  redirect?: string;
}

/** The same answer whether the email is unknown, has no password (Google only) or the password is wrong. */
const WRONG = 'Wrong email or password.';
const NOT_CONFIRMED = 'Confirm your email first: open the link we sent you.';
const TOO_MANY = 'Too many attempts. Wait 15 minutes, then try again.';
/** The same answer whether or not the email has a profile. */
export const LINK_SENT = 'If that email exists, we’ve sent a link. It works for 45 minutes; check your spam folder too.';
const LINK_DEAD = 'This link has expired or was already used. Ask for a new one.';

type Input = Record<string, string | undefined>;
const lang = (v: unknown): UiLang => (v === 'uz' ? 'uz' : 'en');

/** Sign up, log in, password links and change password. Every input is validated here, whatever the browser checked. */
@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  constructor(
    private readonly users: UsersRepository,
    private readonly auth: AuthRepository,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly choice: CourseChoiceService,
    private readonly mail: MailService,
  ) {}

  /**
   * The database is down or misconfigured: say so on the form instead of crashing the page.
   * The reason goes to the server log (and /api/health) for whoever runs the app.
   */
  private unavailable(e: unknown, fields?: Record<string, string>): FormState {
    const { problem, message } = describeDbError(e);
    this.log.error(`Database unavailable (${problem}). ${message}`);
    return { error: 'The app can’t reach its database right now. Please try again in a few minutes.', fields };
  }

  async login(input: Input): Promise<FormState> {
    const email = normalizeEmail(input.email);
    const fields = { email };
    try {
      if (!(await this.limiter.hitIp('login:ip', 30, 15 * MIN)) || !(await this.limiter.hit(`login:email:${email}`, 10, 15 * MIN))) {
        return { error: TOO_MANY, fields };
      }
      const parsed = parseForm(loginSchema, { email: input.email ?? '', password: input.password ?? '' });
      if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
      const user = await this.users.findUserByEmail(parsed.data.email);
      if (!user?.passwordHash) {
        await burnPasswordCheck(parsed.data.password); // same timing whether or not there is a password to check
        return { error: WRONG, fields };
      }
      if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return { error: WRONG, fields };
      if (needsRehash(user.passwordHash)) await this.users.setPasswordHash(user.id, await hashPassword(parsed.data.password)); // an older hash scheme: upgrade it now
      if (await this.users.mustConfirm(user)) return { error: NOT_CONFIRMED, unconfirmed: user.email, fields };
      await this.users.ensureAdminRole(user);
      await this.choice.adopt(user.id);
      await this.sessions.start(user.id);
    } catch (e) {
      return this.unavailable(e, fields);
    }
    return { redirect: safeNext(input.next) };
  }

  /** Email the "confirm your address" link (after the answer has gone out). */
  private async mailConfirmLink(user: UserRow, language: UiLang): Promise<void> {
    const token = await this.auth.createResetToken(user.id, CONFIRM_HOURS * HOUR);
    const link = `${this.mail.appUrl()}/confirm-email?token=${token}`;
    after(() => this.mail.sendPasswordEmail({ to: user.email, name: user.displayName, link, lang: language, purpose: 'confirm' }));
  }

  /**
   * Sign up: nobody is logged in yet. The profile is made, a link is emailed, and clicking it
   * (GET /confirm-email) confirms the address, logs in and opens the app. Only real Gmail addresses.
   */
  async signup(input: Input): Promise<FormState> {
    const visitor = String(input.visitor ?? '');
    const fields = { name: cleanDisplayName(input.name ?? ''), email: normalizeEmail(input.email) };
    try {
      if (!(await this.limiter.hitIp('signup', 20, HOUR))) return { error: 'Too many new profiles from this network. Try again in an hour.', fields };
      const parsed = parseForm(signupSchema, { name: input.name ?? '', email: input.email ?? '', password: input.password ?? '', confirm: input.confirm ?? '' });
      if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
      const { name, email, password } = parsed.data;
      if (!(await this.limiter.hit(`confirm:email:${email}`, 5, HOUR))) return { error: 'We’ve already sent a few emails to this address. Check your inbox, or try again in an hour.', fields };
      await this.users.confirmSince(); // the cutoff is written before the first account that needs confirming exists
      const passwordHash = await hashPassword(password);
      let user = await this.users.createUser({
        email,
        displayName: name,
        passwordHash,
        visitorId: VISITOR_RE.test(visitor) ? visitor : null,
        courseId: this.choice.chosen(),
      });
      if (user === 'taken') {
        // An address someone typed but never confirmed can be claimed again; a confirmed one can't.
        const old = await this.users.findUserByEmail(email);
        if (!old || !(await this.users.mustConfirm(old))) return { fieldErrors: { email: 'Email already registered.' }, fields };
        await this.users.replaceUnconfirmed(old.id, { displayName: name, passwordHash });
        user = old;
      }
      await this.mailConfirmLink(user, lang(input.lang));
    } catch (e) {
      return this.unavailable(e, fields);
    }
    return { sent: fields.email, fields };
  }

  /** "Send it again" on the check-your-inbox screen and on a refused log-in. Same answer for any address. */
  async resendConfirmation(input: Input): Promise<FormState> {
    const email = normalizeEmail(input.email);
    try {
      if (!(await this.limiter.hitIp('confirm:ip', 10, HOUR))) return { error: 'Too many requests from this network. Try again in an hour.', sent: email };
      if (await this.limiter.hit(`confirm:email:${email}`, 5, HOUR)) {
        const user = await this.users.findUserByEmail(email);
        if (user && (await this.users.mustConfirm(user))) await this.mailConfirmLink(user, lang(input.lang));
      }
    } catch (e) {
      return { ...this.unavailable(e), sent: email };
    }
    return { sent: email, success: 'Sent again. It can take a minute; check your spam folder too.' };
  }

  /** The link in the confirmation email: confirms the address, signs in. Returns where to send the browser. */
  async confirmEmail(token: string): Promise<string> {
    if (!/^[\w-]{20,200}$/.test(token)) return '/login?confirm=expired';
    try {
      if (!(await this.limiter.hitIp('confirm:use', 30, 15 * MIN))) return '/login?confirm=expired';
      const user = await this.users.useConfirmToken(token);
      if (!user) return '/login?confirm=expired';
      await this.users.ensureAdminRole(user); // the link proved the address
      await this.choice.adopt(user.id);
      await this.sessions.start(user.id);
    } catch {
      return '/login?confirm=error';
    }
    return '/app?joined=email'; // into the course they signed up for (counted once by Metrica)
  }

  async changePassword(user: UserRow, input: Input): Promise<FormState> {
    const parsed = parseForm(changePasswordSchema, { current: input.current ?? '', password: input.password ?? '', confirm: input.confirm ?? '' });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
    try {
      if (!(await this.limiter.hit(`password:${user.id}`, 10, 15 * MIN))) return { error: TOO_MANY };
      if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { fieldErrors: { current: 'That’s not your current password.' } };
      await this.users.setPasswordHash(user.id, await hashPassword(parsed.data.password));
      await this.auth.deleteUserSessions(user.id, this.sessions.token()); // sign out your other devices
    } catch (e) {
      return this.unavailable(e);
    }
    return { success: 'Password changed. Your other devices were signed out.' };
  }

  /**
   * Make a password link and email it once the answer has gone out, so answering takes about as
   * long whether or not the email has a profile. A Google-only profile gets a "set a password"
   * email: the same link, worded for someone who has no password yet.
   */
  private async mailPasswordLink(user: UserRow, language: UiLang): Promise<void> {
    const token = await this.auth.createResetToken(user.id, RESET_MINUTES * MIN);
    const link = `${this.mail.appUrl()}/reset-password?token=${token}`;
    const purpose = user.hasPassword ? 'reset' : 'set';
    after(() => this.mail.sendPasswordEmail({ to: user.email, name: user.displayName, link, lang: language, purpose }));
  }

  async forgotPassword(input: Input): Promise<FormState> {
    const fields = { email: normalizeEmail(input.email) };
    const parsed = parseForm(forgotSchema, { email: input.email ?? '' });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, fields };
    const { email } = parsed.data;
    try {
      if (!(await this.limiter.hitIp('forgot:ip', 10, HOUR))) return { error: 'Too many requests from this network. Try again in an hour.', fields };
      // At most 3 emails an hour to one address. Beyond that the answer stays the same, but nothing is sent.
      if (await this.limiter.hit(`forgot:email:${email}`, 3, HOUR)) {
        const user = await this.users.findUserByEmail(email);
        if (user) await this.mailPasswordLink(user, lang(input.lang));
      }
    } catch (e) {
      return this.unavailable(e, fields);
    }
    return { success: LINK_SENT };
  }

  async resetPassword(input: Input): Promise<FormState> {
    const parsed = parseForm(resetSchema, { token: input.token ?? '', password: input.password ?? '', confirm: input.confirm ?? '' });
    if (!parsed.ok) return parsed.fieldErrors.token ? { error: LINK_DEAD } : { fieldErrors: parsed.fieldErrors };
    try {
      if (!(await this.limiter.hitIp('reset:ip', 20, 15 * MIN))) return { error: TOO_MANY };
      // Every session of this profile ends with the reset, this browser's too: log in with the new password.
      const user = await this.auth.useResetToken(parsed.data.token, await hashPassword(parsed.data.password));
      if (!user) return { error: LINK_DEAD };
      await this.users.ensureAdminRole(user); // the link proved the address
      await this.sessions.end();
    } catch (e) {
      return this.unavailable(e);
    }
    return { redirect: '/login?reset=1' };
  }

  /** Signed in, e.g. with Google only: email yourself a link to set (or reset) a password. */
  async emailPasswordLink(user: UserRow, input: Input): Promise<FormState> {
    if (!user.email) return { error: 'Your profile has no email address. Ask your teacher to reset your password.' };
    try {
      if (!(await this.limiter.hit(`forgot:email:${user.email}`, 3, HOUR))) return { error: 'We’ve already sent you a few links. Check your inbox, or try again in an hour.' };
      await this.mailPasswordLink(user, lang(input.lang));
    } catch (e) {
      return this.unavailable(e);
    }
    return { success: 'We’ve emailed you a link. It works for 45 minutes; check your spam folder too.' };
  }
}
