'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCourseAction } from '@/app/admin/actions';
import { LANGS, TARGET_LANGS, type Course } from '@/lib/courses';
import { BottomSheet } from '../BottomSheet';
import { Icon } from '../ui';

/**
 * Which course the admin pages show (?course=): admins pick any course and can start a new one;
 * teachers pick among the courses they teach.
 */
export function CourseBar({ course, courses, admin }: { course: Course; courses: Course[]; admin: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const open = (id: string) => router.push(`${path}?course=${encodeURIComponent(id)}`);
  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setCreating(false);
      setClosing(false);
    }, 200);
  };
  return (
    <div className="course-bar">
      {courses.length > 1 ? (
        <select aria-label="Course" value={course.id} onChange={(e) => open(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ) : (
        <span className="course-bar-name">{course.name}</span>
      )}
      {admin && (
        <button className="btn btn-sm" onClick={() => setCreating(true)}><Icon name="plus" /> New course</button>
      )}
      {creating && <NewCourseSheet closing={closing} onClose={close} onCreated={(id) => { close(); open(id); }} />}
    </div>
  );
}

/** Admins: a new course. Its link (/c/<id>) is what students open to join it. */
function NewCourseSheet({ closing, onClose, onCreated }: { closing: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const submit = (form: FormData) =>
    startTransition(async () => {
      const input = { id, name, targetLang: String(form.get('lang') ?? ''), note: String(form.get('note') ?? '') };
      const r = await createCourseAction(input);
      if (r.ok) onCreated(input.id);
      else setError(r.error);
    });
  return (
    <BottomSheet title="New course" onClose={onClose} closing={closing}>
      <form className="form" action={submit}>
        <div className="field">
          <label htmlFor="nc-name">Name</label>
          <input id="nc-name" value={name} required maxLength={60} placeholder="English · Speak Up center" data-autofocus
            onChange={(e) => {
              setName(e.target.value);
              if (!idTouched) setId(slug(e.target.value));
            }} />
        </div>
        <div className="field">
          <label htmlFor="nc-id">Link</label>
          <input id="nc-id" value={id} required maxLength={30} autoCapitalize="off" spellCheck={false}
            onChange={(e) => { setIdTouched(true); setId(slug(e.target.value)); }} />
          <p className="hint">Students join with <b>/c/{id || 'your-link'}</b>. It can’t be changed later.</p>
        </div>
        <div className="field">
          <label htmlFor="nc-lang">Language studied</label>
          <select id="nc-lang" name="lang" defaultValue="en">
            {TARGET_LANGS.map((l) => <option key={l} value={l}>{LANGS[l].name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nc-note">Note for students <span className="muted">(optional)</span></label>
          <input id="nc-note" name="note" maxLength={80} placeholder="More words coming soon" />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending ? 'Creating…' : 'Create course'}</button>
        <p className="hint">Words come next: import a list, use the AI helper, or ask for a built-in list. Make someone its teacher under Manage once they’ve joined.</p>
      </form>
    </BottomSheet>
  );
}
