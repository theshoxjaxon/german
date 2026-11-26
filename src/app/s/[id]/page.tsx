import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ShareView } from '@/components/ShareView';
import { api } from '@/lib/api';
import { shareTitle, type ShareCard } from '@/lib/share';

/** The card behind a share link, or null when there is none. */
async function getShare(id: string): Promise<ShareCard | null> {
  const r = await api<{ card: ShareCard }>(`/share/${encodeURIComponent(id)}`);
  return r.ok ? r.data.card : null;
}

const DESCRIPTION = 'Siz ham sinab koʻring: oʻzbekcha tarjimali kartochkalar, sinov testlari va birga mashq. Bepul.';

/** The link preview: the result in the title; the picture is opengraph-image.tsx next to this file. */
export async function generateMetadata({ params }: PageProps<'/s/[id]'>): Promise<Metadata> {
  const card = await getShare((await params).id);
  const title = card ? shareTitle(card) : 'Karteikasten';
  return {
    title: `${title} · Karteikasten`,
    description: DESCRIPTION,
    openGraph: { title, description: DESCRIPTION, siteName: 'Karteikasten', locale: 'uz_UZ', type: 'website' },
    robots: { index: false }, // a person's result: reachable by its link, never listed by search engines
  };
}

/** /s/<id>: someone's shared result, and "Try it too" into the same course. */
export default function SharePage({ params }: PageProps<'/s/[id]'>) {
  return (
    <Suspense fallback={<main className="share"><div className="panel loading" aria-busy="true">Karteikasten…</div></main>}>
      <Shared params={params} />
    </Suspense>
  );
}

async function Shared({ params }: Pick<PageProps<'/s/[id]'>, 'params'>) {
  const card = await getShare((await params).id);
  if (!card) notFound();
  return <ShareView card={card} />;
}
