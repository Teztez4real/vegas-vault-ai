import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }) {
  return <>{children}</>;
}