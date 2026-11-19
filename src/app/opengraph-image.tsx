import { ImageResponse } from 'next/og';

/**
 * The card chat apps (Telegram, WhatsApp, Instagram) show under a link to the app. Text without
 * oʻ / gʻ: the default image font may not have the modifier letter.
 */
export const alt = 'Karteikasten: nemis tili uchun kartochkalar, sinov testlari va birga mashq';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#131a23';
const MARK = '#ffd447';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#e8ecf1', color: INK }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {/* The app icon: a card box with a yellow card */}
          <div style={{ width: 112, height: 112, borderRadius: 28, background: INK, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 22 }}>
            <div style={{ width: 68, height: 44, borderRadius: 8, background: MARK, display: 'flex' }} />
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>Karteikasten</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>Nemis tili uchun kartochkalar, sinov testlari va birga mashq</div>
          <div style={{ fontSize: 30, color: '#465163' }}>Momente A1 · Lektion 1–12 · bepul</div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {['Kartochkalar', 'Sinov testlari', 'Birga mashq'].map((t) => (
            <div key={t} style={{ display: 'flex', padding: '14px 28px', borderRadius: 999, background: t === 'Sinov testlari' ? MARK : '#ffffff', border: '2px solid #b4bdc9', fontSize: 30, fontWeight: 700 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
