import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Navigation from '../components/Navigation';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Component {...pageProps} />
    </div>
  );
}
