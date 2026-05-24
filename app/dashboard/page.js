'use client';
import dynamic from 'next/dynamic';

const VegasVaultApp = dynamic(() => import('@/components/VegasVaultApp'), { ssr: false });

export default function DashboardPage() {
  return <VegasVaultApp />;
}
