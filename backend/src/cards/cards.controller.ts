import { BadRequestException, Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';
import type { CardDoc } from '@/lib/types';
import { CurrentUser } from '@api/auth/auth.decorators';
import { fail } from '@api/common/http-errors';
import { isValidId, sanitizeCard } from '@api/common/validate';
import type { UserRow } from '@api/users/users.repository';
import { CardsRepository } from './cards.repository';

const MAX_CARDS = 5000;

/** Your progress on words: one card per word, always filed under your own id. */
@Controller()
export class CardsController {
  constructor(private readonly cards: CardsRepository) {}

  /** Reset your progress in your active course. */
  @Delete('cards')
  async resetAll(@CurrentUser() user: UserRow) {
    await this.cards.deleteAllCards(user.id, user.courseId);
  }

  /** Move the progress a guest kept in their browser into their profile after signing up. */
  @Post('cards/import') @HttpCode(200)
  async import(@CurrentUser() user: UserRow, @Body() body: { cards?: unknown; prefs?: unknown } | undefined) {
    if (!body || typeof body.cards !== 'object' || body.cards === null || Array.isArray(body.cards)) throw new BadRequestException('Expected { cards }.');
    const entries = Object.entries(body.cards as Record<string, unknown>);
    if (entries.length > MAX_CARDS) throw new BadRequestException('Too many cards.');
    const cards: Record<string, CardDoc> = {};
    for (const [id, raw] of entries) {
      const doc = isValidId(id) ? sanitizeCard(raw) : null;
      if (doc) cards[id] = doc;
    }
    return { imported: await this.cards.importCards(user.id, cards, body.prefs) };
  }

  @Put('cards/:id')
  async save(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: unknown) {
    if (!isValidId(id)) throw new BadRequestException('Invalid word id.');
    const card = sanitizeCard(body);
    if (!card) throw new BadRequestException('Invalid progress data.');
    if ((await this.cards.putCard(user.id, id, card)) === 'no-word') throw fail(404, 'That word no longer exists.');
  }

  @Delete('cards/:id')
  async forget(@CurrentUser() user: UserRow, @Param('id') id: string) {
    if (!isValidId(id)) throw new BadRequestException('Invalid word id.');
    await this.cards.putCard(user.id, id, null);
  }

  /** Your settings (daily goal, interface language, …). */
  @Put('prefs')
  prefs(@CurrentUser() user: UserRow, @Body() body: unknown) {
    return this.cards.putPrefs(user.id, body);
  }
}
