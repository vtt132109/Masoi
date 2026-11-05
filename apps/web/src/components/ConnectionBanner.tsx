import { WifiOff } from 'lucide-react';
import { vi } from '../i18n/vi';
import { reclaimSession } from '../net/client';
import { useApp } from '../store';
import { Button } from './Button';

export function ConnectionBanner() {
  const conn = useApp((s) => s.conn);
  if (conn === 'connected') return null;

  if (conn === 'replaced') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6">
        <div className="card anim-pop max-w-sm p-6 text-center">
          <WifiOff className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden />
          <p className="mb-4 font-medium">{vi.conn.replaced}</p>
          <Button variant="primary" onClick={reclaimSession}>
            {vi.conn.useHere}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[65] flex items-center justify-center gap-2 bg-wolf px-3 py-2 text-sm font-semibold text-white safe-top"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      {conn === 'connecting' ? vi.conn.connecting : vi.conn.reconnecting}
    </div>
  );
}
