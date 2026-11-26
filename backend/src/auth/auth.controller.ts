import { Body, Controller, Get, Header, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { safeNext } from '@/lib/account-rules';
import { VISITOR_RE } from '@/lib/text';
import { MIN } from '@/lib/time';
import { fail, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import { CourseChoiceService } from '@api/courses/course-choice.service';
import { describeDbError } from '@api/database/db-health';
import { UsersRepository, type UserRow } from '@api/users/users.repository';
import { Logger } from '@nestjs/common';
import { CurrentUser, OptionalUser, Public } from './auth.decorators';
import { AuthService, type FormState } from './auth.service';
import { googleClientId, verifyGoogleCredential } from './google';
import { SessionService } from './session.service';

type Fields = Record<string, string | undefined>;

const googleBody = z.object({
  credential: z.string().min(20).max(8192), // the ID token (a JWT) from the Google button
  next: z.string().max(500).optional(),
  visitor: z.string().regex(VISITOR_RE).optional().catch(undefined),
});

/**
 * Sign-in endpoints. The form ones (login, signup, password links) always answer 200 with a
 * FormState (an error to show, field errors, or `redirect`), exactly what the web forms render.
 */
@Controller('auth')
export class AuthController {
  private readonly log = new Logger('Auth');

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersRepository,
    private readonly choice: CourseChoiceService,
    private readonly limiter: RateLimiter,
  ) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Body() body: Fields): Promise<FormState> {
    return this.auth.login(body ?? {});
  }

  @Public() @Post('signup') @HttpCode(200)
  signup(@Body() body: Fields): Promise<FormState> {
    return this.auth.signup(body ?? {});
  }

  @Public() @Post('confirmation/resend') @HttpCode(200)
  resend(@Body() body: Fields): Promise<FormState> {
    return this.auth.resendConfirmation(body ?? {});
  }

  /** The link in the confirmation email: confirm, sign in, and say where to go. */
  @Public() @Get('confirm')
  async confirm(@Query('token') token?: string): Promise<{ redirect: string }> {
    return { redirect: await this.auth.confirmEmail(token ?? '') };
  }

  @Public() @Post('password/forgot') @HttpCode(200)
  forgot(@Body() body: Fields): Promise<FormState> {
    return this.auth.forgotPassword(body ?? {});
  }

  @Public() @Post('password/reset') @HttpCode(200)
  reset(@Body() body: Fields): Promise<FormState> {
    return this.auth.resetPassword(body ?? {});
  }

  @Post('password/change') @HttpCode(200)
  change(@CurrentUser() user: UserRow, @Body() body: Fields): Promise<FormState> {
    return this.auth.changePassword(user, body ?? {});
  }

  @Post('password/email-link') @HttpCode(200)
  emailLink(@CurrentUser() user: UserRow, @Body() body: Fields): Promise<FormState> {
    return this.auth.emailPasswordLink(user, body ?? {});
  }

  /** Sign out this browser, then send it to the login page. */
  @Public() @Post('logout') @Header('Location', '/login')
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    if (!this.sessions.sameOrigin()) throw fail(403, 'Cross-site request blocked.');
    await this.sessions.end();
    res.status(303);
  }

  /** "Continue with Google": checks the ID token Google signed and signs in (or signs up). */
  @Public() @Post('google') @HttpCode(200)
  async google(@Body() raw: unknown) {
    if (!this.sessions.sameOrigin()) throw fail(403, 'Cross-site request blocked.');
    if (!googleClientId()) throw fail(503, 'Google sign-in isn’t set up on this server.');
    const parsed = googleBody.safeParse(raw);
    if (!parsed.success) throw fail(400, 'Google sign-in failed. Try again.');
    const { credential, next, visitor } = parsed.data;
    try {
      if (!(await this.limiter.hitIp('google:ip', 30, 15 * MIN))) throw tooMany('Too many attempts. Wait 15 minutes, then try again.');
      let profile;
      try {
        profile = await verifyGoogleCredential(credential);
      } catch (e) {
        this.log.warn(`A Google token was refused. ${(e as Error).message}`);
        throw fail(401, 'Google sign-in failed. Try again.');
      }
      const result = await this.users.googleSignIn(profile, { visitorId: visitor, courseId: this.choice.chosen() });
      if (result === 'unverified') throw fail(403, 'Google hasn’t verified this email address, so it can’t be used here.');
      if (result === 'other-google') throw fail(409, 'This email is linked to a different Google account. Log in with your password instead.');
      const user = await this.users.ensureAdminRole(result.user);
      await this.choice.adopt(user.id);
      await this.sessions.start(user.id);
      return { next: safeNext(next), created: result.created };
    } catch (e) {
      if (e instanceof Error && 'getStatus' in e) throw e;
      const { problem, message } = describeDbError(e);
      this.log.error(`Google sign-in failed (${problem}). ${message}`);
      throw fail(503, 'The app can’t reach its database right now. Please try again in a few minutes.');
    }
  }
}
