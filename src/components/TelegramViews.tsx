'use client';

import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { useTelegram } from '@/lib/client/telegram';
import { Icon } from './ui';
import { useUI } from './ui-context';

/**
 * The evening reminder on Telegram: its section in Settings, and the card on the home screen
 * that offers it once you have studied today. Both stay hidden while the bot isn't set up.
 */

/** Connect: first a button that makes a one-time link, then the link itself (phones open Telegram from a real link). */
function ConnectButton({ tg }: { tg: ReturnType<typeof useTelegram> }) {
  const { t } = useT();
  if (tg.link) {
    return (
      <>
        <a className="btn btn-primary" href={tg.link} target="_blank" rel="noopener noreferrer"><Icon name="send" /> {t('Open Telegram')}</a>
        <p className="hint" role="status">{t('In Telegram, press Start. This page updates by itself.')}</p>
      </>
    );
  }
  return (
    <button className="btn btn-primary" disabled={tg.busy} onClick={() => void tg.connect()}>
      <Icon name="send" /> {t('Connect Telegram')}
    </button>
  );
}

export function TelegramSection() {
  const { t } = useT();
  const ui = useUI();
  const tg = useTelegram(true, () => ui.toast(t('Telegram connected')));
  if (!tg.state?.available) return null;
  return (
    <div className="settings-group tg-section">
      <p className="section-title">Telegram</p>
      {tg.state.linked ? (
        <>
          <label className="toggle-row">
            <input type="checkbox" checked={tg.state.reminders} disabled={tg.busy} onChange={(e) => void tg.setReminders(e.target.checked)} />
            <span>{t('Evening reminder')}<small>{t('One message in the evening if you haven’t practised that day: your streak and how many cards wait.')}</small></span>
          </label>
          <button className="btn btn-quiet" disabled={tg.busy} onClick={() => void tg.disconnect()}>{t('Disconnect Telegram')}</button>
        </>
      ) : (
        <>
          <p className="hint">{t('Get one message in the evening if you haven’t practised that day: your streak and how many cards wait.')}</p>
          <ConnectButton tg={tg} />
        </>
      )}
      {tg.error && <p className="err" role="alert">{t(tg.error)}</p>}
    </div>
  );
}

/** On the home screen, after you've studied today: "Shall I remind you tomorrow?" Until connected or dismissed. */
export function TelegramCard() {
  const { t } = useT();
  const ui = useUI();
  const [dismissed, setDismissed] = useLocalState('kk.tgCard', false, (v) => typeof v === 'boolean');
  const tg = useTelegram(!dismissed, () => ui.toast(t('Telegram connected')));
  if (dismissed || !tg.state?.available || (tg.state.linked && !tg.link)) return null;
  return (
    <section className="tg-card" aria-labelledby="tg-card-h">
      <span className="tg-card-ic" aria-hidden="true"><Icon name="send" /></span>
      <div className="tg-card-body">
        <h2 id="tg-card-h">{t('Shall I remind you tomorrow?')}</h2>
        <p>{t('One Telegram message in the evening, only if you haven’t practised yet.')}</p>
        <div className="btn-row">
          <ConnectButton tg={tg} />
          {!tg.link && <button className="btn btn-quiet" onClick={() => setDismissed(true)}>{t('Not now')}</button>}
        </div>
        {tg.error && <p className="err" role="alert">{t(tg.error)}</p>}
      </div>
    </section>
  );
}
