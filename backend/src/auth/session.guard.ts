import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_KEY, type Access } from './auth.decorators';
import { SessionService } from './session.service';

/**
 * Global guard: every route needs a signed-in person unless it says otherwise (@Public,
 * @OptionalUser, @AdminOnly). It also renews old sessions and records the visit.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest();
    // Login and sign-up are public but must not be driven from another site either (login CSRF).
    if (access === 'public') {
      this.sessions.assertSameOrigin();
      return true;
    }
    const user = await this.sessions.authenticate({ admin: access === 'admin', optional: access === 'optional' });
    if (user) req.user = user;
    return true;
  }
}
