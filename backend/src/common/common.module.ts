import { Global, Module } from '@nestjs/common';
import { RateLimiter } from './rate-limit.service';
import { RequestContext } from './request-context.service';

@Global()
@Module({ providers: [RequestContext, RateLimiter], exports: [RequestContext, RateLimiter] })
export class CommonModule {}
