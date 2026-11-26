import { Injectable } from '@nestjs/common';
import { RequestContext } from '@api/common/request-context.service';
import { appUrl, sendPasswordEmail } from './mail';

export { CONFIRM_HOURS, RESET_MINUTES } from './mail';

/** The one email the app sends (a password or confirmation link) and the site address for links. */
@Injectable()
export class MailService {
  constructor(private readonly ctx: RequestContext) {}

  /** The site's public address, for links in emails. */
  appUrl(): string {
    return appUrl(this.ctx.none ? undefined : this.ctx.host);
  }

  sendPasswordEmail = sendPasswordEmail;
}
