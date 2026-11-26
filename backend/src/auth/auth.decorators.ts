import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { UserRow } from '@api/users/users.repository';

/** How a route treats the session cookie. Without a decorator a route needs a signed-in person. */
export type Access = 'public' | 'optional' | 'admin';
export const ACCESS_KEY = 'access';

/** Anyone may call it (health, sign-in, cron jobs that check their own secret). */
export const Public = () => SetMetadata(ACCESS_KEY, 'public' satisfies Access);
/** Guests and signed-in people alike: `@CurrentUser()` is undefined for a guest. */
export const OptionalUser = () => SetMetadata(ACCESS_KEY, 'optional' satisfies Access);
/** Admins only. */
export const AdminOnly = () => SetMetadata(ACCESS_KEY, 'admin' satisfies Access);

/** The signed-in user the SessionGuard found. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserRow => ctx.switchToHttp().getRequest().user);
