/**
 * Every mock test, with its answer key. Server-only: routes hand out publicTest() before a test
 * and the full test (to review) only after it was submitted.
 */
import type { AttemptDetail, Test, TestInfo } from '@/lib/tests/types';
import { omit } from '@/lib/tests/score';
import { attemptSummary, type AttemptRow } from '@api/tests/attempts.repository';
import { GERMAN_A1_TESTS } from '@/lib/tests/german-a1';

export const TESTS: Test[] = [...GERMAN_A1_TESTS];

/** A course's tests, in order. */
export const testsFor = (courseId: string) => TESTS.filter((t) => t.course === courseId);
export const findTest = (id: string) => TESTS.find((t) => t.id === id) ?? null;

/** For the list: no questions. */
export const testInfo = (test: Test): TestInfo => omit(test, 'sections');

/** A submitted attempt with the test's answers and model answers, for reviewing it. */
export function attemptDetail(a: AttemptRow, test: Test): AttemptDetail {
  return { ...attemptSummary(a), answers: a.answers, result: a.result, test, ...(a.aiError ? { aiError: a.aiError } : {}) };
}
