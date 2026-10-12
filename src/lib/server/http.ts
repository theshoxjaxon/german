/** Small helpers shared by the route handlers. */
export const ok = (body: unknown = { ok: true }) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
export const badRequest = (message: string) => Response.json({ error: message }, { status: 400 });

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
