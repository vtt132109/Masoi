import { Check, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { vi } from '../i18n/vi';
import { roomLink } from '../lib/format';
import { useApp } from '../store';
import { Button } from './Button';

export function RoomCode({ code, showQr = false }: { code: string; showQr?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useApp((s) => s.toast);

  useEffect(() => {
    if (!showQr) return;
    let alive = true;
    QRCode.toDataURL(roomLink(code), {
      margin: 1,
      width: 360,
      color: { dark: '#0B1020', light: '#FFFFFF' },
    })
      .then((url) => alive && setQr(url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [code, showQr]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomLink(code));
      setCopied(true);
      toast(vi.common.copied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(roomLink(code));
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted">
        {vi.lobby.code}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Mã phòng ${code.split('').join(' ')}. Chạm để sao chép link.`}
        className="font-display rounded-[16px] border border-line bg-raised px-5 py-2 text-[44px] font-bold leading-none tracking-[0.22em] transition hover:border-accent/60 active:scale-[0.98]"
      >
        {code}
      </button>
      {showQr && qr ? (
        <div className="flex flex-col items-center gap-1.5">
          <img
            src={qr}
            alt={`Mã QR vào phòng ${code}`}
            width={180}
            height={180}
            className="rounded-[14px] bg-white p-1.5"
          />
          <span className="text-xs text-muted">{vi.lobby.scanToJoin}</span>
        </div>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={copy}
        icon={
          copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )
        }
      >
        {vi.lobby.copyLink}
      </Button>
    </div>
  );
}
