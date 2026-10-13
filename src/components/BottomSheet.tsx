'use client';

import { useContext, useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { Icon } from './ui';
import { UIContext } from './ui-context';

/**
 * A sheet that slides up from the bottom of the screen.
 * Close it with the ×, a tap on the backdrop, Escape, or by dragging the handle down.
 */
export function BottomSheet({ title, children, footer, onClose, closing }: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Outside the main app (the admin page), the parent controls closing. */
  onClose?: () => void;
  closing?: boolean;
}) {
  const ui = useContext(UIContext);
  const closeSheet = onClose ?? ui?.closeSheet ?? (() => {});
  const sheetClosing = closing ?? ui?.sheetClosing ?? false;
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);

  // Move focus into the sheet: the field marked data-autofocus, else the close button.
  useEffect(() => {
    const el = sheetRef.current;
    const target = el?.querySelector<HTMLElement>('[data-autofocus]') || el?.querySelector<HTMLElement>('.sheet-head .icon-btn');
    const raf = requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button') || !sheetRef.current) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetRef.current.style.transition = 'none';
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || !sheetRef.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    sheetRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !sheetRef.current) return;
    sheetRef.current.style.transition = '';
    if (d.dy > 110) closeSheet();
    else sheetRef.current.style.transform = '';
  };
  const dragHandlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

  return (
    <div className={`sheet-layer${sheetClosing ? ' closing' : ''}`}>
      <div className="backdrop" onClick={closeSheet} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={sheetRef}>
        <div className="sheet-grip" aria-hidden="true" {...dragHandlers}>
          <i />
        </div>
        <header className="sheet-head" {...dragHandlers}>
          <h2 id="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={closeSheet} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
