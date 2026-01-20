import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NFT Races - Provably Fair Racing',
  description: 'Provably fair racing for CyberPets and other NFT collections on Ergo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
