import { aiEnabled } from '@/lib/server/ai';
import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { testInfo, testsFor } from '@/lib/server/tests';

/** GET /api/tests → the mock tests of your course and your attempts at them (newest first). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const tests = testsFor(user.courseId);
  const attempts = tests.length ? await repo.listAttempts(user.id, user.courseId) : [];
  return ok({ tests: tests.map(testInfo), attempts, ai: aiEnabled() });
}
