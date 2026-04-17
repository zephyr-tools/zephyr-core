import type { AppSettings, PluginSettingSpec } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  Download,
  FolderUp,
  Info,
  Key,
  Puzzle,
  RefreshCw,
  RotateCw,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { type JSX, useEffect, useMemo, useState } from 'react';
import { usePluginContext } from '@/contexts/PluginContext';
import { cn } from '@/lib/cn';

type Tab = 'general' | 'application' | 'plugins';

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

  const { specs } = usePluginContext();

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
              <TabButton active={tab === 'plugins'} onClick={() => setTab('plugins')}>
                Plugins
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
          ) : tab === 'plugins' ? (
            <PluginsTab specs={specs.settings} />
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

function PluginsTab({ specs }: { specs: PluginSettingSpec[] }): JSX.Element {
  const qc = useQueryClient();
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const loaded = useQuery({
    queryKey: ['plugins-list'],
    queryFn: () => window.api.listPlugins(),
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PluginSettingSpec[]>();
    for (const s of specs) {
      const list = map.get(s.pluginId) ?? [];
      list.push(s);
      map.set(s.pluginId, list);
    }
    return [...map.entries()];
  }, [specs]);

  async function save(pluginId: string, key: string, value: unknown): Promise<void> {
    await window.api.setPluginSetting(pluginId, key, value);
    qc.invalidateQueries({ queryKey: ['plugin-ui'] });
  }

  async function runInstallFromUrl(): Promise<void> {
    const url = urlDraft.trim();
    if (!url) return;
    setActionError(null);
    try {
      await window.api.installPlugin(url);
      setUrlDraft('');
      setRestartNeeded(true);
      qc.invalidateQueries({ queryKey: ['plugins-list'] });
      qc.invalidateQueries({ queryKey: ['plugin-ui'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runInstallFromZip(): Promise<void> {
    setActionError(null);
    try {
      const zipPath = await window.api.pickPluginZip();
      if (!zipPath) return;
      await window.api.installPluginFromZip(zipPath);
      setRestartNeeded(true);
      qc.invalidateQueries({ queryKey: ['plugins-list'] });
      qc.invalidateQueries({ queryKey: ['plugin-ui'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runRemove(pluginId: string): Promise<void> {
    setActionError(null);
    try {
      await window.api.removePlugin(pluginId);
      setRestartNeeded(true);
      qc.invalidateQueries({ queryKey: ['plugins-list'] });
      qc.invalidateQueries({ queryKey: ['plugin-ui'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  const installMutation = useMutation({ mutationFn: runInstallFromUrl });
  const zipMutation = useMutation({ mutationFn: runInstallFromZip });

  return (
    <div className="flex flex-col gap-6">
      {restartNeeded && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
          <RotateCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Restart required</div>
            <div className="text-amber-300/70">
              Changes to installed plugins take effect after Zephyr restarts.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void window.api.restartApp()}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500"
          >
            Restart now
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          {actionError}
        </div>
      )}

      {/* Installed plugins */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Installed {loaded.data && loaded.data.length > 0 ? `(${loaded.data.length})` : ''}
        </h3>
        {!loaded.data || loaded.data.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-center text-xs text-zinc-500">
            No plugins installed. Install one below or place a plugin folder in{' '}
            <span className="font-mono text-zinc-400">userData/plugins/</span>.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {loaded.data.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
              >
                <Puzzle className="h-4 w-4 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-zinc-500">
                    {p.id} · v{p.version}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runRemove(p.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-200"
                  title={`Remove ${p.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Install */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Install</h3>

        <Field
          label="From URL"
          hint="HTTPS URL to a plugin ZIP archive. Only install from sources you trust — plugins run with full system access."
        >
          <div className="flex gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://example.com/my-plugin.zip"
              disabled={installMutation.isPending}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => installMutation.mutate()}
              disabled={!urlDraft.trim() || installMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow shadow-brand-700/40',
                'hover:bg-brand-500 disabled:opacity-50',
              )}
            >
              <Download className="h-3.5 w-3.5" />
              {installMutation.isPending ? 'Installing…' : 'Install'}
            </button>
          </div>
        </Field>

        <Field
          label="From local file"
          hint="Pick a .zip file on your computer containing exactly one top-level folder with index.js. Settings from a prior install are preserved."
        >
          <button
            type="button"
            onClick={() => zipMutation.mutate()}
            disabled={zipMutation.isPending}
            className={actionBtnClass}
          >
            <FolderUp className="h-3.5 w-3.5" />
            {zipMutation.isPending ? 'Installing…' : 'Choose ZIP…'}
          </button>
        </Field>
      </section>

      {/* Plugin-provided settings */}
      {grouped.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-zinc-800 pt-5">
          <div className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <Puzzle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Settings exposed by installed plugins. Changes are live without a restart.</span>
          </div>
          {grouped.map(([pluginId, fields]) => (
            <div key={pluginId} className="flex flex-col gap-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {pluginId}
              </h4>
              {fields.map((spec) => (
                <PluginSettingField
                  key={spec.key}
                  spec={spec}
                  onSave={(value) => save(pluginId, spec.key, value)}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function PluginSettingField({
  spec,
  onSave,
}: {
  spec: PluginSettingSpec;
  onSave: (value: unknown) => Promise<void>;
}): JSX.Element {
  const initial = spec.value;
  const initialStr = stringify(initial);
  const [draft, setDraft] = useState<string>(initialStr);
  const [toggle, setToggle] = useState<boolean>(initial === true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (spec.type === 'toggle') setToggle(initial === true);
    else setDraft(stringify(initial));
  }, [initial, spec.type]);

  if (spec.type === 'toggle') {
    return (
      <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm text-zinc-200">{spec.label}</span>
          {spec.hint ? <span className="text-xs text-zinc-500">{spec.hint}</span> : null}
        </div>
        <input
          type="checkbox"
          checked={toggle}
          disabled={saving}
          onChange={async (e) => {
            const next = e.target.checked;
            setToggle(next);
            setSaving(true);
            try {
              await onSave(next);
            } finally {
              setSaving(false);
            }
          }}
          className="h-4 w-4 accent-brand-500"
        />
      </label>
    );
  }

  if (spec.type === 'select') {
    const options = spec.options ?? [];
    return (
      <Field label={spec.label} hint={spec.hint}>
        <select
          value={draft}
          disabled={saving}
          onChange={async (e) => {
            const next = e.target.value;
            setDraft(next);
            const match = options.find((o) => String(o.value) === next);
            setSaving(true);
            try {
              await onSave(match?.value ?? next);
            } finally {
              setSaving(false);
            }
          }}
          className={inputClass}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  async function commit(): Promise<void> {
    if (draft === initialStr) return;
    setSaving(true);
    try {
      if (spec.type === 'number') {
        if (draft.trim() === '') {
          await onSave(null);
        } else {
          const n = Number(draft);
          if (Number.isNaN(n)) return;
          await onSave(n);
        }
      } else {
        await onSave(draft);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field label={spec.label} hint={spec.hint}>
      <input
        type={spec.type === 'password' ? 'password' : spec.type === 'number' ? 'number' : 'text'}
        min={spec.type === 'number' ? spec.min : undefined}
        max={spec.type === 'number' ? spec.max : undefined}
        step={spec.type === 'number' ? spec.step : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        disabled={saving}
        className={inputClass}
      />
    </Field>
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
