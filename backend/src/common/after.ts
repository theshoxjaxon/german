/**
 * Run work after the answer has gone out (an email, say), so answering takes about as long
 * whether or not there is anything to send. On Vercel this keeps the function alive until the
 * work is done; elsewhere the promise simply runs on.
 */
export function after(task: () => Promise<unknown>): void {
  const run = task().catch((e) => console.error('Karteikasten: background task failed:', (e as Error).message));
  import('@vercel/functions').then((m) => m.waitUntil(run)).catch(() => undefined);
}
