import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FiSearch, FiBell } from 'react-icons/fi';

interface NavItem { label: string; href: string }
const nav: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'Frameworks', href: '/frameworks/create' },
  { label: 'Test Runs', href: '/testruns' },
  { label: 'Reports', href: '/reports' }
];

export default function Header() {
  const { pathname } = useRouter();
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-gray-800">QA Dashboard</Link>
          <nav className="flex gap-4 text-sm">
            {nav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded-full transition-colors ${pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input aria-label="Search" placeholder="Search" className="pl-9 pr-3 py-1.5 w-56 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button className="relative p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
            <FiBell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white flex items-center justify-center text-sm font-medium select-none">U</div>
        </div>
      </div>
    </header>
  );
}
