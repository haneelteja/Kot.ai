import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

export const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-mono',
  display: 'swap',
});
