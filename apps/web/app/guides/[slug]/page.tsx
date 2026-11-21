import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicPage } from '@/components/public-page';
import { GUIDES } from '@/lib/guides';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDES.find((g) => g.slug === slug);
  return guide ? { title: guide.title, description: guide.summary } : { title: 'Guide' };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) notFound();
  return (
    <PublicPage title={guide.title} intro={guide.summary}>
      {guide.body}
      <p>
        <Link href="/guides">← Tous les guides</Link>
      </p>
    </PublicPage>
  );
}
