import type { AppSettings } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Info, Key, RefreshCw, Shield, Trash2, X } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Tab = 'general' | 'application';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps): JSX.Element | null {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');

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

  const appVersion = useQuery({
    queryKey: ['app-version'],
    queryFn: () => window.api.getAppVersion(),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/70 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="no-drag flex h-[80vh] w-[min(520px,90vw)] flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + tabs */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 pt-5 pb-0">
          <div className="flex items-end gap-4">
            <h2 className="pb-3 text-base font-semibold">Settings</h2>
            <nav className="flex gap-1">
              <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
                General
              </TabButton>
              <TabButton active={tab === 'application'} onClick={() => setTab('application')}>
                Application
              </TabButton>
            </nav>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mb-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!draft ? (
            <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
          ) : tab === 'general' ? (
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
          ) : (
            <div className="flex flex-col gap-4">
              <Field icon={<Info className="h-4 w-4 text-zinc-500" />} label="Current version">
                <span className="font-mono text-sm text-zinc-300">v{appVersion.data ?? '…'}</span>
              </Field>

              <Field
                icon={<RefreshCw className="h-4 w-4 text-zinc-500" />}
                label="Software updates"
                hint="Checks GitHub for a newer release. Updates download in the background and apply on restart."
              >
                <button
                  type="button"
                  onClick={async () => {
                    setCheckingUpdate(true);
                    setCheckResult(null);
                    try {
                      await window.api.checkForUpdate();
                      setCheckResult('up-to-date');
                    } catch {
                      setCheckResult('error');
                    } finally {
                      setCheckingUpdate(false);
                    }
                  }}
                  disabled={checkingUpdate}
                  className={actionBtnClass}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', checkingUpdate && 'animate-spin')} />
                  {checkingUpdate
                    ? 'Checking…'
                    : checkResult === 'up-to-date'
                      ? 'Up to date'
                      : checkResult === 'error'
                        ? 'Check failed'
                        : 'Check for updates'}
                </button>
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
                  className={actionBtnClass}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {clearCache.isPending
                    ? 'Clearing…'
                    : clearCache.isSuccess
                      ? 'Cleared'
                      : 'Clear cache'}
                </button>
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

const actionBtnClass =
  'flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-b-2 px-3 pb-2.5 text-sm font-medium transition',
        active
          ? 'border-brand-500 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}

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
