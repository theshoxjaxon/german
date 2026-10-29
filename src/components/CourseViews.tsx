'use client';

import { useState } from 'react';
import type { Course } from '@/lib/courses';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { BottomSheet } from './BottomSheet';
import { Icon } from './ui';
import { useUI } from './ui-context';

/**
 * Courses in the app: the pill in the top bar that shows which course you're studying, the sheet
 * to switch, and the "What are you learning?" picker a guest sees first (when there is more than
 * one course). Each course has its own words, class and progress.
 */

/** The top-bar pill: the current course. Hidden while there is only one course. */
export function CoursePill() {
  const { course, courses } = useStore();
  const ui = useUI();
  const { t } = useT();
  if (!course || courses.length < 2) return null;
  return (
    <button className="course-pill" onClick={() => ui.openSheet({ kind: 'course' })} aria-label={t('Course: {name}. Switch course', { name: course.name })}>
      <Icon name="book" />
      <span className="course-pill-name">{course.name}</span>
      <Icon name="down" />
    </button>
  );
}

/** One course to pick: its name, how many lesson words it has, and its note ("More words coming soon"). */
function CourseOption({ c, current, busy, onPick }: { c: Course; current: boolean; busy: boolean; onPick: () => void }) {
  const { t, tn } = useT();
  return (
    <button className="course-opt" role="radio" aria-checked={current} disabled={busy} onClick={onPick}>
      <span className="course-opt-text">
        <b>{c.name}</b>
        <span className="muted small">
          {tn(c.words, '{n} word', '{n} words')}
          {c.note && <> · {t(c.note)}</>}
        </span>
      </span>
      <Icon name={current ? 'check' : 'next'} />
    </button>
  );
}

function useSwitch(after?: () => void) {
  const [busy, setBusy] = useState(false);
  const pick = async (id: string) => {
    setBusy(true);
    const ok = await store.switchCourse(id);
    setBusy(false);
    if (ok) after?.();
  };
  return { busy, pick };
}

export function CourseSheet() {
  const { course, courses, guest } = useStore();
  const ui = useUI();
  const { t } = useT();
  const { busy, pick } = useSwitch(ui.closeSheet);
  return (
    <BottomSheet title={t('Courses')}>
      <div className="course-list" role="radiogroup" aria-label={t('Courses')}>
        {courses.map((c) => (
          <CourseOption key={c.id} c={c} current={c.id === course?.id} busy={busy} onPick={() => pick(c.id)} />
        ))}
      </div>
      <p className="hint">
        {t(guest
          ? 'Each course has its own words and progress. Your progress in a course stays when you switch.'
          : 'Each course has its own words, class and progress. Your progress in a course stays when you switch.')}
      </p>
    </BottomSheet>
  );
}

/** A guest's first screen when there are several courses. Links like /c/english skip it. */
export function CoursePicker() {
  const { courses } = useStore();
  const { t } = useT();
  const { busy, pick } = useSwitch();
  return (
    <div className="page">
      <section className="course-picker" aria-labelledby="pick-h">
        <span className="locked-ic"><Icon name="book" /></span>
        <h1 id="pick-h">{t('What are you learning?')}</h1>
        <p>{t('Pick your course. You can switch any time from the top bar.')}</p>
        <div className="course-list" role="radiogroup" aria-labelledby="pick-h">
          {courses.map((c) => (
            <CourseOption key={c.id} c={c} current={false} busy={busy} onPick={() => pick(c.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
