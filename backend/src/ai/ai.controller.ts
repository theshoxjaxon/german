import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AI_IMAGE_TYPES, AI_MAX_IMAGE_CHARS, AI_MAX_LINES, AI_MAX_TEXT, isAiLanguage, type AiImageType, type AiRequest } from '@/lib/ai-shared';
import { HOUR } from '@/lib/time';
import { CurrentUser } from '@api/auth/auth.decorators';
import { fail, tooMany } from '@api/common/http-errors';
import { RateLimiter } from '@api/common/rate-limit.service';
import { CoursesRepository } from '@api/courses/courses.repository';
import type { UserRow } from '@api/users/users.repository';
import { AiError } from './ai';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly limiter: RateLimiter, private readonly courses: CoursesRepository) {}

  /** POST /api/ai/words: a photo or some typed words → flashcards. Each use costs money, so there is an hourly limit per person. */
  @Post('words')
  @HttpCode(200)
  async words(@CurrentUser() user: UserRow, @Body() body: Partial<AiRequest> | undefined) {
    if (!this.ai.enabled()) throw fail(503, 'The AI helper isn’t switched on for this app.');
    if (!body || (body.mode !== 'photo' && body.mode !== 'text') || !isAiLanguage(body.language)) {
      throw new BadRequestException('Send { mode: "photo" | "text", language, image | text }.');
    }
    const request: AiRequest = { mode: body.mode, language: body.language };
    if (body.mode === 'photo') {
      const image = body.image;
      if (!image || typeof image.data !== 'string' || !image.data || !AI_IMAGE_TYPES.includes(image.mediaType as AiImageType)) {
        throw new BadRequestException('Choose a photo (JPEG, PNG, WebP or GIF).');
      }
      if (image.data.length > AI_MAX_IMAGE_CHARS) throw new BadRequestException('That photo is too large.');
      request.image = { data: image.data, mediaType: image.mediaType as AiImageType };
    } else {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) throw new BadRequestException('Type at least one word.');
      if (text.length > AI_MAX_TEXT || text.split('\n').length > AI_MAX_LINES) throw new BadRequestException(`Send up to ${AI_MAX_LINES} words at a time.`);
      request.text = text;
    }
    if (!(await this.limiter.hit(`ai:${user.id}`, user.role === 'admin' ? 60 : 20, HOUR))) {
      throw tooMany('You’ve used the AI helper a lot this hour. Try again later, or add words by hand.');
    }
    try {
      return await this.ai.makeWords(request, (await this.courses.getCourse(user.courseId))?.targetLang);
    } catch (e) {
      if (e instanceof AiError) throw fail(e.status, e.message);
      throw e;
    }
  }
}
