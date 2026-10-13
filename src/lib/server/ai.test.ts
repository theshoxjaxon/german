/**
 * The AI word helper against a fake Claude API on localhost: the real SDK, the real streaming
 * code and our validation, with no API key and no cost.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let ai: typeof import('./ai');
let lastBody: Record<string, unknown> = {};
let lastHeaders: Record<string, string | string[] | undefined> = {};
let reply: { text: string; stop: string } = { text: '{}', stop: 'end_turn' };

/** A Messages API stream (server-sent events) carrying `text` as one text block. */
function sse(text: string, stop: string): string {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return [
    ev('message_start', {
      message: {
        id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [],
        stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 },
      },
    }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    // Split the answer to exercise the stream accumulator.
    ...[text.slice(0, 20), text.slice(20)].map((t) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: t } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 50 } }),
    ev('message_stop', {}),
  ].join('');
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastBody = JSON.parse(body || '{}');
      lastHeaders = req.headers;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(sse(reply.text, reply.stop));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.AI_MODEL;
  ai = await import('./ai');
});
afterAll(() => server.close());

const word = (o: Record<string, unknown> = {}) => ({
  term: 'der Bahnhof', meaning: 'train station', pos: 'noun', pronunciation: '[ˈbaːnhoːf]', forms: 'die Bahnhöfe',
  example: 'Der Bahnhof ist groß.', exampleTr: 'The station is big.', mnemonic: 'Bahn = train, Hof = yard', tags: ['Travel'], ...o,
});

describe('AI word helper', () => {
  it('sends the photo with a JSON schema, medium effort and refusal fallbacks', async () => {
    reply = { text: JSON.stringify({ topic: 'Lektion 5', note: '', words: [word()] }), stop: 'end_turn' };
    const result = await ai.makeWords({ mode: 'photo', language: 'uz', image: { data: 'aGVsbG8=', mediaType: 'image/jpeg' } });
    expect(result.topic).toBe('Lektion 5');
    expect(result.words).toEqual([expect.objectContaining({ term: 'der Bahnhof', pos: 'noun', tags: ['travel'] })]);

    expect(lastBody.model).toBe('claude-opus-5-5');
    expect(lastBody.stream).toBe(true);
    expect(lastBody.output_config).toMatchObject({ effort: 'medium', format: { type: 'json_schema' } });
    expect(lastBody.fallbacks).toBe('default');
    expect(String(lastHeaders['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(String(lastBody.system)).toContain('Uzbek');
    const content = (lastBody.messages as { content: { type: string; source?: { media_type: string } }[] }[])[0].content;
    expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } });
  });

  it('sends a typed list as data inside <list> tags', async () => {
    reply = { text: JSON.stringify({ topic: '', note: '', words: [word(), word({ term: 'der Zug', meaning: 'train' })] }), stop: 'end_turn' };
    const result = await ai.makeWords({ mode: 'text', language: 'en', text: 'Bahnhof\nZug – train' });
    expect(result.words.map((w) => w.term)).toEqual(['der Bahnhof', 'der Zug']);
    const content = (lastBody.messages as { content: { type: string; text?: string }[] }[])[0].content;
    expect(content[0].text).toContain('<list>\nBahnhof\nZug – train\n</list>');
  });

  it('cleans the answer: drops empty and duplicate terms, caps lengths, unknown types → other', () => {
    const r = ai.parseResult(JSON.stringify({
      topic: 'T'.repeat(500),
      note: '',
      words: [word(), word({ term: 'DER BAHNHOF' }), word({ term: '  ' }), word({ term: 'gehen', pos: 'banana', meaning: '' }), 'junk'],
    }));
    expect(r.topic).toHaveLength(80);
    expect(r.words.map((w) => [w.term, w.pos, w.meaning])).toEqual([['der Bahnhof', 'noun', 'train station'], ['gehen', 'other', '—']]);
  });

  it('turns a cut-off or declined answer into a message the person can act on', async () => {
    reply = { text: '{"topic":"","words":[{"term":"der Ba', stop: 'max_tokens' };
    await expect(ai.makeWords({ mode: 'text', language: 'en', text: 'x' })).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/too many words/) });
    reply = { text: '', stop: 'refusal' };
    await expect(ai.makeWords({ mode: 'text', language: 'en', text: 'x' })).rejects.toMatchObject({ status: 422 });
    expect(() => ai.parseResult('not json')).toThrow(/cut off/);
  });

  it('is on only with credentials, and can be switched off', () => {
    expect(ai.aiEnabled()).toBe(true);
    process.env.AI_ENABLED = 'false';
    expect(ai.aiEnabled()).toBe(false);
    delete process.env.AI_ENABLED;
  });
});
