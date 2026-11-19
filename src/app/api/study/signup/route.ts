import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { TIMEZONE } from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { canStudy, cleanSlots, removeSignup, saveSignup, studyState } from '@/lib/server/study';
import { signupWeek } from '@/lib/study/week';
import { HOUR } from '@/lib/time';

/** PUT /api/study/signup { slots } → "I want to study" next week at these hours (changeable until Sunday 18:00). */
export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  if (!canStudy(user)) return Response.json({ error: 'Study groups are for the students of this course.' }, { status: 403 });
  if (!(await hit(`study-signup:${user.id}`, 60, HOUR))) return Response.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  const body = (await readJson(req)) as { slots?: unknown } | undefined;
  const slots = cleanSlots(body?.slots);
  if (!slots) return badRequest('Send { slots }.');
  if (!slots.length) return badRequest('Pick at least one hour when you’re free.');
  await saveSignup(user.id, user.courseId, signupWeek(Date.now(), TIMEZONE), slots);
  return ok(await studyState(user));
}

/** DELETE /api/study/signup → not next week after all. */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  await removeSignup(auth.user.id, auth.user.courseId, signupWeek(Date.now(), TIMEZONE));
  return ok(await studyState(auth.user));
}
