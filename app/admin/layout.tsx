'use client';
import Image from 'next/image';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {Map, LogOut} from 'lucide-react';

export default function AdminLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', {method: 'POST'});
    router.push('/admin/login');
  }

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 px-4 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Image src="/images/devrat-logo-transparent.png" alt="Devrat" width={28} height={28} className="h-7 w-auto" />
            </div>
            <span className="text-sm font-semibold text-white">Beat Tracker Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/beats"
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${pathname.startsWith('/admin/beats') ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Map className="h-4 w-4" /> Beats
            </Link>
            <Link href="/beats" target="_blank" className="text-xs text-gray-400 hover:text-white transition">
              View Dashboard ↗
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
