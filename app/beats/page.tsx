import {Suspense} from 'react';
import type {Metadata} from 'next';
import {BeatDashboard} from '@/components/BeatDashboard';

export const metadata: Metadata = {
  title: 'Beat Tracker — Devrat',
  robots: {index: false, follow: false},
};

export default function BeatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BeatDashboard />
    </Suspense>
  );
}
