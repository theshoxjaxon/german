import { ImageResponse } from 'next/og';
import { LANGS } from '@/lib/courses';
import { translate } from '@/lib/i18n';
import { imageSafe, type ShareCard } from '@/lib/share';
import { getShare } from '@/lib/server/shares';

/**
 * The picture under a shared link in Telegram and the like: the score (or the streak) big, the
 * first name and the test. Uzbek text through imageSafe(): the image font has no ʻ.
 */
export const alt = 'Karteikasten';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#131a23';
const INK2 = '#465163';
const MARK = '#ffd447';
const GOOD = '#146c3e';
const FLAME = '#c2560c';
const RULE = 'rgba(205, 60, 70, .55)';

function Brand({ lang }: { lang: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: INK, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 14 }}>
          <div style={{ width: 44, height: 28, borderRadius: 6, background: MARK, display: 'flex' }} />
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Karteikasten</div>
      </div>
      <div style={{ display: 'flex', padding: '10px 24px', borderRadius: 999, background: '#ffffff', border: '2px solid #b4bdc9', fontSize: 30, fontWeight: 700 }}>{lang}</div>
    </div>
  );
}

function Body({ card }: { card: ShareCard }) {
  if (card.kind === 'streak') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <svg width="190" height="190" viewBox="0 0 24 24" fill={FLAME}>
          <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-2.9 1.9-4.7 3.4-6.3.3 1.6 1 2.6 2 3.1-.3-3.4 1.2-6.2 3.6-8.2.2 2.7 1.4 4.3 2.4 5.8.8 1.2 1.6 2.4 1.6 4.3C19 18.6 16 21 12 21z" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div style={{ display: 'flex', fontSize: 190, fontWeight: 700, lineHeight: 1 }}>{card.streak}</div>
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{imageSafe('kun ketma-ket')}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: INK2, marginTop: 12 }}>{imageSafe(`${card.name} har kuni oʻrganmoqda`)}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', fontSize: 40, color: INK2 }}>{imageSafe(`${card.name} · ${card.level}`)}</div>
      <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, maxWidth: 1060 }}>{imageSafe(card.title)}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontSize: 150, fontWeight: 700, lineHeight: 1 }}>{card.score}</div>
          <div style={{ display: 'flex', fontSize: 64, color: INK2, fontWeight: 700 }}>{`/${card.max}`}</div>
        </div>
        {card.passed && (
          <div style={{ display: 'flex', padding: '12px 30px', borderRadius: 999, background: '#dff1e6', color: GOOD, fontSize: 40, fontWeight: 700 }}>Bestanden</div>
        )}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const card = await getShare((await params).id);
  const lang = card ? translate('uz', LANGS[card.targetLang].name) : 'Nemis tili';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 64px', background: '#e8ecf1', color: INK }}>
        <Brand lang={imageSafe(lang)} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '28px 40px', borderRadius: 32, background: '#ffffff', borderBottom: `6px solid ${RULE}` }}>
          {card ? <Body card={card} /> : <div style={{ fontSize: 56, fontWeight: 700 }}>Karteikasten</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 32, fontWeight: 700 }}>
          <div style={{ display: 'flex', flexShrink: 0, padding: '10px 26px', borderRadius: 999, background: MARK }}>{imageSafe('Siz ham sinab koʻring')}</div>
          <div style={{ display: 'flex', color: INK2, fontWeight: 400 }}>{imageSafe('Kartochkalar va sinov testlari, bepul')}</div>
        </div>
      </div>
    ),
    size,
  );
}
