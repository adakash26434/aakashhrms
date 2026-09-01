'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function PlatformLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch('/api/platform/auth/logout', { method: 'POST' });
      router.push('/platform/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-200/80 hover:text-rose-200 hover:bg-rose-600/20 active:scale-[0.98] transition-all border border-transparent hover:border-rose-500/30 cursor-pointer disabled:opacity-50"
    >
      <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
      <span className="truncate">{loading ? 'Exiting...' : 'Exit Control Plane'}</span>
    </button>
  );
}
