import type { Release } from '@shared/types';
import type { JSX } from 'react';
import { ReleaseCard } from './ReleaseCard';

interface ReleaseGridProps {
  releases: Release[];
}

export function ReleaseGrid({ releases }: ReleaseGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {releases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </div>
  );
}
