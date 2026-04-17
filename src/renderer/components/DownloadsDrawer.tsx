import type { DownloadJob, RdPhase } from '@shared/types';
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronDown,
  Cloud,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
} from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import { formatSize } from '@/lib/format';

const RD_PHASE_LABELS: Record<RdPhase, string> = {
  'fetching-metadata': 'Finding peers on Real-Debrid…',
  'queued-remote': 'Queued on Real-Debrid',
  'rd-downloading': 'Downloading on Real-Debrid',
  'rd-processing': 'Processing on Real-Debrid',
  transferring: 'Transferring to your disk',
};

interface DownloadsDrawerProps {
  open: boolean;
  onClose: () => void;
  jobs: DownloadJob[];
}

export function DownloadsDrawer({ open, onClose, jobs }: DownloadsDrawerProps): JSX.Element {
  const activeCount = jobs.filter((j) => j.status === 'downloading').length;
  const totalDown = jobs.reduce((s, j) => s + j.downloadSpeed, 0);

  return (
    <div
      className={cn(
        'border-t border-zinc-900 bg-zinc-950 transition-all duration-200 overflow-hidden shrink-0',
        open ? 'h-72' : 'h-0',
      )}
    >
      {/* Drawer header */}
      <div className="flex items-center gap-3 border-b border-zinc-900 px-5 py-2.5 text-sm">
        <ArrowDownToLine className="h-4 w-4 text-zinc-400 shrink-0" />
        <span className="font-medium text-zinc-200">Downloads</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {activeCount}
          </span>
        )}
        {totalDown > 0 && (
          <span className="text-xs text-zinc-500">↓ {formatSize(totalDown)}/s</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          title="Close downloads"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Job list */}
      <div className="overflow-y-auto h-[calc(288px-41px)]">
        {jobs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            No downloads
          </div>
        ) : (
          jobs.map((job) => <JobRow key={job.infoHash} job={job} />)
        )}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: DownloadJob }): JSX.Element {
  const pct = Number.isFinite(job.progress) ? Math.round(job.progress * 100) : 0;
  const isActive = job.status === 'downloading';
  const isPaused = job.status === 'paused';
  const isQueued = job.status === 'queued';
  const isSeeding = job.status === 'seeding';
  const isError = job.status === 'error';
  const isRd = job.origin === 'real-debrid';
  const rdPhaseLabel = isRd && job.rdPhase ? RD_PHASE_LABELS[job.rdPhase] : null;
  const peerLabel = isRd ? 'S' : 'P';

  return (
    <div className="flex flex-col gap-1.5 border-b border-zinc-900/60 px-5 py-3">
      {/* Row 1: name + speed + actions */}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200" title={job.name}>
          {job.name || 'Resolving metadata…'}
        </span>

        <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
          {isRd && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Cloud className="h-3 w-3" />
              RD
            </span>
          )}
          {isActive && job.downloadSpeed > 0 && <span>↓ {formatSize(job.downloadSpeed)}/s</span>}
          {(isActive || isSeeding) && job.uploadSpeed > 0 && (
            <span>↑ {formatSize(job.uploadSpeed)}/s</span>
          )}
          {isQueued && <span className="text-zinc-500 font-medium">Queued</span>}
          {isSeeding && <span className="text-emerald-500 font-medium">Complete</span>}
          {isError && (
            <span className="text-red-400 font-medium" title={job.error}>
              Error
            </span>
          )}
          {job.numPeers > 0 && (
            <span>
              {job.numPeers}
              {peerLabel}
            </span>
          )}
          <ScanBadge scanStatus={job.scanStatus} scanInfo={job.scanInfo} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isActive && (
            <button
              type="button"
              onClick={() => void window.api.pauseDownload(job.infoHash)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              title="Pause"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={() => void window.api.resumeDownload(job.infoHash)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              title="Resume"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {isSeeding && (
            <button
              type="button"
              onClick={() => window.api.showItemInFolder(job.revealPath ?? job.savePath)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              title="Show in folder"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void window.api.removeDownload(job.infoHash)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              'h-1 rounded-full transition-all duration-500',
              isSeeding ? 'bg-emerald-600' : isError ? 'bg-red-600' : 'bg-brand-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right text-xs text-zinc-500">{pct}%</span>
      </div>

      {/* Row 3: phase label + size info */}
      <div className="flex items-center justify-between gap-3 text-xs">
        {rdPhaseLabel && isActive ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
            {rdPhaseLabel}
          </span>
        ) : isError && job.error ? (
          <span className="truncate text-red-400/80" title={job.error}>
            {job.error}
          </span>
        ) : (
          <span />
        )}
        {job.totalSize > 0 && (
          <span className="shrink-0 text-zinc-600">
            {formatSize(job.downloaded)} / {formatSize(job.totalSize)}
          </span>
        )}
      </div>

      {/* Row 4: non-fatal RD hint (e.g. "no seeders yet") */}
      {job.rdMessage && isActive && (
        <div className="inline-flex items-start gap-1.5 rounded-md bg-yellow-900/20 px-2 py-1 text-[11px] text-yellow-300/90">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{job.rdMessage}</span>
        </div>
      )}
    </div>
  );
}

function ScanBadge({
  scanStatus,
  scanInfo,
}: {
  scanStatus?: string;
  scanInfo?: string;
}): JSX.Element | null {
  if (!scanStatus || scanStatus === 'pending') return null;

  if (scanStatus === 'scanning') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400"
        title="Scanning…"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Scanning
      </span>
    );
  }

  if (scanStatus === 'clean') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400"
        title={scanInfo ?? 'Clean'}
      >
        <ShieldCheck className="h-3 w-3" />
        Clean
      </span>
    );
  }

  if (scanStatus === 'threat') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-400"
        title={scanInfo ?? 'Threat detected'}
      >
        <ShieldAlert className="h-3 w-3" />
        Threat
      </span>
    );
  }

  // scanStatus === 'error'
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-yellow-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-500"
      title={scanInfo ?? 'Scan failed'}
    >
      <ShieldQuestion className="h-3 w-3" />
      Unsure
    </span>
  );
}
