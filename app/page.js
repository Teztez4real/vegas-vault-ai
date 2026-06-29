'use client';
import dynamic from 'next/dynamic';

// Render the landing page client-side only (it checks auth + redirects
// signed-in users to /dashboard). Isolated from the dashboard component
// so it has zero impact on app stability.
const LandingPage = dynamic(() => import('@/components/LandingPage'), { ssr: false });

export default function RootPage() {
  return <LandingPage />;
}
