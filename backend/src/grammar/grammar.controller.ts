import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { perfektVerbs } from '@/lib/grammar/verbs';
import { applySession, MAX_ANSWERS, pickSession, progressOf, sanitizeState, type Given, type Task } from '@/lib/grammar/session';
import { HOUR } from '@/lib/time';
import { UI_LANGS, type UiLang } from '@/lib/types';
import { AiService } from '@api/ai/ai.service';
import { AiError } from '@api/ai/ai';
import { MAX_TEXT, MIN_TEXT } from '@api/ai/ai-perfekt';
import { CurrentUser } from '@api/auth/auth.decorators';
import { fail, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import type { UserRow } from '@api/users/users.repository';
import { GrammarRepository } from './grammar.repository';

const TOPIC = 'perfekt';

/** Grammar practice: the Perfekt (verbs, the helper verb and the participle). */
@Controller('grammar/perfekt')
export class GrammarController {
  constructor(private readonly grammar: GrammarRepository, private readonly limiter: RateLimiter, private readonly ai: AiService) {}

  /** Your progress and a new practice session picked from it. */
  @Get()
  async session(@CurrentUser() user: UserRow) {
    const now = Date.now();
    const verbs = perfektVerbs();
    const state = sanitizeState(await this.grammar.getGrammar(user.id, TOPIC));
    return { verbs, progress: progressOf(state, now), tasks: pickSession(verbs, state, now), ai: this.ai.enabled() };
  }

  /** Save the answers of a finished session; answers a new one. */
  @Post() @HttpCode(200)
  async save(@CurrentUser() user: UserRow, @Body() body: { answers?: unknown } | undefined) {
    const list = Array.isArray(body?.answers) ? body.answers : null;
    if (!list?.length || list.length > MAX_ANSWERS) throw new BadRequestException('No answers to save.');
    const answers = list
      .filter((a): a is { task: Task; given: Given } => !!a && typeof a === 'object' && !!(a as { task?: unknown }).task && typeof (a as { task?: unknown }).task === 'object')
      .map((a) => ({ task: a.task, given: a.given }));
    if (!(await this.limiter.hit(`grammar:${user.id}`, 30, HOUR))) throw tooMany('That’s a lot of practice for one hour. Take a break and come back later.');
    const now = Date.now();
    const verbs = perfektVerbs();
    const out = applySession(sanitizeState(await this.grammar.getGrammar(user.id, TOPIC)), verbs, answers, now);
    if (!out.answered) throw new BadRequestException('No answers to save.');
    await this.grammar.saveGrammar(user.id, TOPIC, out.state, out.answered, now);
    const { answered, right, before, after, missed } = out;
    return { progress: progressOf(out.state, now), outcome: { answered, right, before, after, missed }, tasks: pickSession(verbs, out.state, now) };
  }

  /** The AI reads a few sentences with the Perfekt and says what is right and what to fix. */
  @Post('check') @HttpCode(200)
  async check(@CurrentUser() user: UserRow, @Body() body: { text?: unknown; lang?: unknown } | undefined) {
    if (!this.ai.enabled()) throw fail(503, 'The AI helper isn’t switched on for this app.');
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (text.length < MIN_TEXT) throw new BadRequestException('Write a few sentences first.');
    if (text.length > MAX_TEXT) throw new BadRequestException('That’s too long. Write 3–5 sentences.');
    const lang: UiLang = UI_LANGS.includes(body?.lang as UiLang) ? (body!.lang as UiLang) : 'en';
    if (!(await this.limiter.hit(`grammar-check:${user.id}`, 8, HOUR))) throw tooMany('You’ve asked for a lot of checks this hour. Try again later.');
    try {
      return { check: await this.ai.checkPerfektText(text, lang) };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      throw fail(e.status, e.message);
    }
  }
}
