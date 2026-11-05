'use client';

import { useState, useTransition } from 'react';
import { telegramCheckAction, telegramQuizAction, telegramSetupAction, telegramTestAction } from '@/app/admin/actions';
import type { CheckLine } from '@/lib/server/telegram';
import { Icon } from '../ui';

export interface TelegramAdminStatus {
  problems: string[]; // settings missing in the environment (names only)
  cron: boolean; // CRON_SECRET is set, so the evening job can run
  linked: number;
  remindersOn: number;
  sentToday: number;
  channel: string | null; // TELEGRAM_CHANNEL, for the daily quiz
  quizToday: string | null; // today's quiz word, once posted
}

/**
 * /admin, admins only: the Telegram bot behind the evening reminders. Shows what's missing,
 * connects the bot, sends a test, and counts (never who: chat ids are never shown).
 */
export function AdminTelegram({ status, onDone }: { status: TelegramAdminStatus; onDone: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [lines, setLines] = useState<CheckLine[] | null>(null);
  const check = async () => {
    const r = await telegramCheckAction();
    if (r.ok) setLines(r.lines);
    else setResult({ ok: false, text: r.error });
  };
  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, thenCheck = false) =>
    startTransition(async () => {
      const r = await action();
      setResult({ ok: r.ok, text: r.ok ? r.message : r.error });
      if (r.ok) onDone(r.message);
      if (thenCheck) await check(); // right after connecting: does Telegram now reach the site?
    });
  const checkButton = (
    <button className="btn" disabled={pending} onClick={() => startTransition(check)}>
      <Icon name="search" /> Check the bot
    </button>
  );
  const ready = status.problems.length === 0;
  return (
    <section className="panel" aria-labelledby="tg-h">
      <div className="panel-h"><h2 id="tg-h">Telegram</h2><span className="muted">every evening, ~19:00</span></div>
      {!ready ? (
        <div className="tg-setup">
          <p>Not set up yet. To turn it on:</p>
          <ol className="steps">
            <li>In Telegram, open <b>@BotFather</b>, send <code>/newbot</code> and follow the steps. It gives you a token.</li>
            <li>In Vercel → Project → Settings → Environment Variables, add: {status.problems.map((p) => <code key={p}>{p}</code>).reduce<React.ReactNode[]>((a, c, i) => (i ? [...a, ', ', c] : [c]), [])}.</li>
            <li>Redeploy, come back here and press <b>Connect the bot</b>.</li>
          </ol>
          <p className="hint">Added them already? Press <b>Check the bot</b> to see which one is wrong and how to fix it.</p>
          <div className="btn-row">{checkButton}</div>
        </div>
      ) : (
        <div className="tg-admin">
          <div className="tiles">
            <div className="tile"><p className="tile-l">Connected</p><p className="tile-v">{status.linked}</p><p className="tile-s">students with Telegram</p></div>
            <div className="tile"><p className="tile-l">Reminders on</p><p className="tile-v">{status.remindersOn}</p><p className="tile-s">sent {status.sentToday} today</p></div>
          </div>
          <div className="btn-row">
            <button className="btn" disabled={pending} onClick={() => run(telegramSetupAction, true)}>Connect the bot</button>
            {checkButton}
            <button className="btn" disabled={pending} onClick={() => run(telegramTestAction)}>Send me a test reminder</button>
          </div>
          <div className="tg-channel">
            <h3>Daily quiz channel</h3>
            {status.channel ? (
              <>
                <p>
                  <code>{status.channel}</code> gets a der/die/das quiz every evening, with a button into the German course.{' '}
                  {status.quizToday ? <>Today: <b lang="de">{status.quizToday}</b>.</> : 'Not posted yet today.'}
                </p>
                <div className="btn-row">
                  <button className="btn" disabled={pending || !!status.quizToday} onClick={() => run(telegramQuizAction)}>Post today’s quiz now</button>
                </div>
              </>
            ) : (
              <ol className="steps">
                <li>In Telegram, create a <b>public channel</b> (e.g. “Nemis tili: kuniga bitta soʻz”).</li>
                <li>Add the bot to the channel as an <b>admin</b> that may post messages.</li>
                <li>In Vercel, add <code>TELEGRAM_CHANNEL</code> with the channel’s <code>@name</code> and redeploy.</li>
              </ol>
            )}
          </div>
        </div>
      )}
      {result && <p className={result.ok ? 'hint ok-text' : 'err'} role="status">{result.text}</p>}
      {lines && (
        <ul className="tg-check" aria-label="Bot check">
          {lines.map((l) => (
            <li key={l.label} className={l.ok ? 'is-ok' : 'is-bad'}>
              <Icon name={l.ok ? 'check' : 'x'} />
              <span><b>{l.label}</b>{l.fix && <span className="tg-fix">{l.fix}</span>}</span>
            </li>
          ))}
          {lines.every((l) => l.ok) && <li className="is-ok tg-all-ok"><span>All good. Send /start to the bot: it should answer within a few seconds.</span></li>}
        </ul>
      )}
      {ready && !status.cron && <p className="err">CRON_SECRET isn’t set, so the evening job can’t run. Add it in Vercel and redeploy.</p>}
      <p className="hint">
        Students connect from Settings → Telegram in the app. Each evening those who haven’t practised that day get one message with
        their streak and how many cards wait. It only has their own numbers, and nobody (admins included) can see who is connected.
      </p>
    </section>
  );
}
