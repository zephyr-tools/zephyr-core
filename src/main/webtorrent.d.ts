/**
 * Minimal ambient declaration for webtorrent v2 (which ships no bundled types).
 * Only covers the surface used by torrent-client.ts.
 */
declare module 'webtorrent' {
  interface TorrentOptions {
    path?: string;
    announce?: string[];
    destroyStore?: boolean;
  }

  interface TorrentFile {
    name: string;
    path: string;
    length: number;
  }

  interface Torrent {
    infoHash: string;
    magnetURI: string;
    name: string;
    length: number | undefined;
    progress: number;
    downloaded: number;
    uploaded: number;
    downloadSpeed: number;
    uploadSpeed: number;
    numPeers: number;
    done: boolean;
    paused: boolean;
    ready: boolean;
    destroyed: boolean;
    files: TorrentFile[];
    on(event: 'done' | 'ready' | 'warning', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    once(event: 'done' | 'ready', listener: () => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    pause(): void;
    resume(): void;
    destroy(opts?: { destroyStore?: boolean }, callback?: () => void): void;
  }

  type AddCallback = (torrent: Torrent) => void;

  class WebTorrent {
    static readonly VERSION: string;
    torrents: Torrent[];
    downloadSpeed: number;
    uploadSpeed: number;
    constructor(opts?: Record<string, unknown>);
    add(magnetUriOrFile: string | Buffer, opts: TorrentOptions, callback: AddCallback): Torrent;
    add(magnetUriOrFile: string | Buffer, callback: AddCallback): Torrent;
    get(infoHash: string): Torrent | undefined;
    remove(
      torrentOrHash: Torrent | string,
      opts?: { destroyStore?: boolean },
      callback?: () => void,
    ): void;
    on(event: 'error', listener: (err: Error) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    removeListener(event: 'error', listener: (err: Error) => void): this;
    destroy(callback?: () => void): void;
  }

  export default WebTorrent;
  export type { Torrent, TorrentFile, TorrentOptions };
}
