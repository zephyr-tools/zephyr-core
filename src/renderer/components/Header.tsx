import { ArrowDownToLine, Gamepad2, Settings as SettingsIcon } from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenDownloads: () => void;
  activeDownloads: number;
}

export function Header({
  onOpenSettings,
  onOpenDownloads,
  activeDownloads,
}: HeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        'drag-region sticky top-0 z-20 flex items-center gap-4 border-b border-zinc-900 bg-zinc-950/85 px-5 py-3 backdrop-blur',
      )}
    >
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-700/30">
          <Gamepad2 className="h-4 w-4" />
        </span>
        <span className="hidden text-sm sm:inline">Zephyr Explorer</span>
      </div>

      <SearchBar />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenDownloads}
          className="no-drag relative rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          title="Downloads"
        >
          <ArrowDownToLine className="h-4 w-4" />
          {activeDownloads > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold leading-none text-white">
              {activeDownloads > 9 ? '9+' : activeDownloads}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="no-drag rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          title="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
