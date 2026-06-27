import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Beat Tracker — Devrat Namkeen',
  description: 'Live beat tracker for Devrat Namkeen sales team',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
