import './globals.css';

export const metadata = {
  title: 'NBA Analytics',
  description: 'Live NBA scores and player stats',
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
