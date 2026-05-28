'use client';
import dynamic from 'next/dynamic';
const VegasVaultApp = dynamic(() => import('@/components/VegasVaultApp'), { ssr: false });
<<<<<<< HEAD

export default function DashboardPage() {
  return <VegasVaultApp />;
}
=======
export default function DashboardPage() { return <VegasVaultApp />; }
>>>>>>> 83749ed07b4e8cefcdfa86a1c818b747a1f53cd4
