import './globals.css';
import './shared.css';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import TopNav from './components/TopNav';
import { getCurrentUser, roleOf } from '@/lib/auth';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata = {
  title: 'Release Management Portal · KLAP',
  description: 'RDC · CAB · Jira PAP · Dashboard DORA',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const role = roleOf(user);

  return (
    <html lang="es" className={jakarta.variable}>
      <body className={user ? 'has-sidebar' : ''}>
        {/* La nav solo se muestra con sesión. En /login no hay usuario -> sin nav. */}
        {user ? <TopNav role={role} email={user.email ?? ''} /> : null}
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
