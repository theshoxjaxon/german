import { HttpException } from '@nestjs/common';

/** Throw one of these to answer `{ error: message }` with that status. */
export const fail = (status: number, message: string) => new HttpException(message, status);
export const tooMany = (message: string) => fail(429, message);
export const notAllowed = (message = 'Not allowed.') => fail(401, message);
