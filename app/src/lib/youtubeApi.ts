// Client-side YouTube IFrame API loader.
// Ensures the API script is injected only once regardless of component mount/unmount cycles.

declare global {
  interface Window {
    YT: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YT {
  Player: new (elementId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

export interface YTPlayerOptions {
  height?: string | number;
  width?: string | number;
  videoId: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    enablejsapi?: 0 | 1;
    origin?: string;
    [key: string]: string | number | undefined;
  };
  events?: {
    onReady?: (event: YTEvent) => void;
    onStateChange?: (event: YTStateEvent) => void;
    onError?: (event: YTErrorEvent) => void;
  };
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  getPlayerState(): number;
  destroy(): void;
}

export interface YTEvent {
  target: YTPlayer;
}

export interface YTStateEvent {
  target: YTPlayer;
  data: number;
}

export interface YTErrorEvent {
  target: YTPlayer;
  data: number;
}

let apiPromise: Promise<void> | null = null;

/**
 * Load the YouTube IFrame API exactly once per page lifetime.
 * Safe to call multiple times — returns the same promise.
 */
export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    // Already loaded
    if (typeof window !== "undefined" && window.YT?.Player) {
      resolve();
      return;
    }

    // Chain onto any existing callback (e.g. from another component)
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}
