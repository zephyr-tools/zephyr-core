import type { UpdateInfo } from '@shared/types';
import { Download, RefreshCw, X } from 'lucide-react';
import { type JSX, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export function UpdateNotification(): JSX.Element | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const offAvailable = window.api.onUpdateAvailable((info) => {
      setUpdate(info);
      setDismissed(false);
    });
    const offDownloaded = window.api.onUpdateDownloaded(() => setReady(true));
    return () => {
      offAvailable();
      offDownloaded();
    };
  }, []);

  const handleInstall = useCallback(() => {
    window.api.installUpdate();
  }, []);

  if (!update || dismissed) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur',
        'border-brand-500/30 bg-zinc-900/95 text-zinc-100',
      )}
    >
      {ready ? (
        <RefreshCw className="h-4 w-4 text-brand-400" />
      ) : (
        <Download className="h-4 w-4 animate-pulse text-brand-400" />
      )}

      <span>
        {ready ? (
          <>
            <strong>v{update.version}</strong> ready —{' '}
            <button
              type="button"
              onClick={handleInstall}
              className="font-semibold text-brand-400 underline underline-offset-2 hover:text-brand-300"
            >
              restart to update
            </button>
          </>
        ) : (
          <>
            Downloading <strong>v{update.version}</strong>…
          </>
        )}
      </span>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
