import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from '@api/ai/ai.service';
import { Public } from '@api/auth/auth.decorators';
import { checkDatabase } from '@api/database/db-health';

@Controller('health')
export class HealthController {
  constructor(private readonly ai: AiService) {}

  /** Is the database reachable? 200 when yes, 503 when no. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const database = await checkDatabase();
    res.status(database.ok ? 200 : 503);
    return { ok: database.ok, database, ai: this.ai.enabled(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null };
  }
}
