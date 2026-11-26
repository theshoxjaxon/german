import { Injectable } from '@nestjs/common';
import type { UiLang } from '@/lib/types';
import type { Test } from '@/lib/tests/types';
import { aiEnabled, makeWords } from './ai';
import { gradeOpen } from './ai-grade';
import { checkPerfektText } from './ai-perfekt';

/** The AI helper (Claude): word lists from a photo or text, scoring of written and spoken test answers, grammar checks. */
@Injectable()
export class AiService {
  enabled = aiEnabled;
  makeWords = makeWords;
  gradeOpen = (test: Test, answers: Record<string, unknown>, lang: UiLang) => gradeOpen(test, answers, lang);
  checkPerfektText = checkPerfektText;
}
