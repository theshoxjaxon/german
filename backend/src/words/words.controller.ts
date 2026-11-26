import { BadRequestException, Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';
import { MAX_OWN_WORDS, type WordData } from '@/lib/types';
import { CurrentUser } from '@api/auth/auth.decorators';
import { isValidId, sanitizeWord } from '@api/common/validate';
import { fail } from '@api/common/http-errors';
import type { UserRow } from '@api/users/users.repository';
import { ownerFor, WordsRepository } from './words.repository';

const forbidden = (teacher: boolean) =>
  fail(403, teacher ? 'This is a student’s own word. Only they can change it.' : 'Only your teacher can change lesson words. You can change your own words.');

/**
 * Words. A course's teachers change its shared words; everyone else changes their own
 * (up to MAX_OWN_WORDS), so nobody sees or edits another person's words.
 */
@Controller('words')
export class WordsController {
  constructor(private readonly words: WordsRepository) {}

  /** Add many words at once (Import, "Fill in with AI"). */
  @Post() @HttpCode(200)
  async addMany(@CurrentUser() user: UserRow, @Body() body: { words?: unknown } | undefined) {
    if (!body || !Array.isArray(body.words) || body.words.length > 1000) throw new BadRequestException('Send { words: [...] } with up to 1000 words.');
    const clean: { id: string; data: WordData }[] = [];
    for (const raw of body.words) {
      const id = (raw as { id?: unknown })?.id;
      const data = sanitizeWord(raw);
      if (!isValidId(id) || !data) throw new BadRequestException('Every word needs a valid id, a term and a meaning.');
      clean.push({ id, data });
    }
    const owner = ownerFor(user);
    if (owner && (await this.words.countOwnWords(owner)) + clean.length > MAX_OWN_WORDS) {
      throw new BadRequestException(`You can have up to ${MAX_OWN_WORDS} of your own words.`);
    }
    return { ok: true, count: await this.words.putWords(owner, user.courseId, clean) };
  }

  @Put(':id')
  async save(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: unknown) {
    if (!isValidId(id)) throw new BadRequestException('Invalid word id.');
    const data = sanitizeWord(body);
    if (!data) throw new BadRequestException('A word needs a term and a meaning.');
    const result = await this.words.saveWord(ownerFor(user), user.courseId, id, data);
    if (result === 'forbidden') throw forbidden(user.teacher);
    if (result === 'limit') throw new BadRequestException(`You can have up to ${MAX_OWN_WORDS} of your own words.`);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserRow, @Param('id') id: string) {
    if (!isValidId(id)) throw new BadRequestException('Invalid word id.');
    if ((await this.words.deleteWord(ownerFor(user), user.courseId, id)) === 'forbidden') throw forbidden(user.teacher);
  }
}
