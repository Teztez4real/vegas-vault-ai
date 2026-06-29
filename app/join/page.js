'use client';
import dynamic from 'next/dynamic';
const JoinPage = dynamic(() => import('@/components/JoinPage'), { ssr: false });
export default function Page() { return <JoinPage />; }
