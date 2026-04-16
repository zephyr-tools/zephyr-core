import type { DownloadJob } from '@shared/types';
import { useEffect, useState } from 'react';

/**
 * Subscribes to live download progress pushed from the main process.
 * Initial state is loaded via `listDownloads`, then updated by push events.
 */
export function useDownloads(): DownloadJob[] {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    window.api.listDownloads().then(setJobs).catch(console.error);
    const unsub = window.api.onDownloadProgress(setJobs);
    return unsub;
  }, []);

  return jobs;
}
