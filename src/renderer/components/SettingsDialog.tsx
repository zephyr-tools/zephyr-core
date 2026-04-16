import type { AppSettings } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Key, Shield, Trash2, X } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps): JSX.Element | null {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings(),
    enabled: open,
  });

  const [draft, setDraft] = useState<AppSettings | null>(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => window.api.setSettings(patch),
    onSuccess: (next) => {
      qc.setQueryData(['settings'], next);
      qc.invalidateQueries({ queryKey: ['releases'] });
      onClose();
    },
  });

  const clearCache = useMutation({
    mutationFn: () => window.api.clearArtworkCache(),
    onSuccess: () => qc.removeQueries({ queryKey: ['artwork'] }),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/70 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="no-drag w-[min(520px,90vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!draft ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                geminiApiKey: draft.geminiApiKey?.trim() || null,
                youtubeApiKey: draft.youtubeApiKey?.trim() || null,
                realDebridApiKey: draft.realDebridApiKey?.trim() || null,
                virusTotalApiKey: draft.virusTotalApiKey?.trim() || null,
              });
            }}
            className="flex flex-col gap-4"
          >
            <Field
              icon={<Key className="h-4 w-4 text-zinc-500" />}
              label="Gemini API key"
              hint="Used for artwork and game details. Google AI Studio → Get API key."
            >
              <input
                type="password"
                value={draft.geminiApiKey ?? ''}
                onChange={(e) => setDraft({ ...draft, geminiApiKey: e.target.value })}
                placeholder="AIza…"
                className={inputClass}
              />
            </Field>

            <Field
              icon={<Key className="h-4 w-4 text-zinc-500" />}
              label="YouTube Data API key"
              hint="Used for trailer search. Google Cloud Console → Enable YouTube Data API v3 → Create key."
            >
              <input
                type="password"
                value={draft.youtubeApiKey ?? ''}
                onChange={(e) => setDraft({ ...draft, youtubeApiKey: e.target.value })}
                placeholder="AIza…"
                className={inputClass}
              />
            </Field>

            <Field
              icon={<Cloud className="h-4 w-4 text-zinc-500" />}
              label="Real-Debrid API token"
              hint="Uses Real-Debrid as a seedbox for downloads. real-debrid.com → Account → API token."
            >
              <input
                type="password"
                value={draft.realDebridApiKey ?? ''}
                onChange={(e) => setDraft({ ...draft, realDebridApiKey: e.target.value })}
                placeholder="Token…"
                className={inputClass}
              />
            </Field>

            <Field
              icon={<Shield className="h-4 w-4 text-zinc-500" />}
              label="VirusTotal API key"
              hint="Optional. Checks downloaded executables against 70+ antivirus engines. virustotal.com → Sign up → API key. Windows Defender scans always run regardless."
            >
              <input
                type="password"
                value={draft.virusTotalApiKey ?? ''}
                onChange={(e) => setDraft({ ...draft, virusTotalApiKey: e.target.value })}
                placeholder="Key…"
                className={inputClass}
              />
            </Field>

            <Field
              icon={<Trash2 className="h-4 w-4 text-zinc-500" />}
              label="Image cache"
              hint="Removes all locally cached artwork. Images will be re-fetched on demand."
            >
              <button
                type="button"
                onClick={() => clearCache.mutate()}
                disabled={clearCache.isPending || clearCache.isSuccess}
                className="flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearCache.isPending
                  ? 'Clearing…'
                  : clearCache.isSuccess
                    ? 'Cleared'
                    : 'Clear cache'}
              </button>
            </Field>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className={cn(
                  'rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow shadow-brand-700/40 transition',
                  'hover:bg-brand-500 disabled:opacity-50',
                )}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
