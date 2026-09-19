/**
 * Audio Player for Cognora Voice
 *
 * Robust, leak-free HTML5 Audio manager.
 * Guarantees race-condition safety via monotonic session tokens.
 */

export type AudioPlayerStatus =
  | "idle"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export interface AudioPlayerEvents {
  onStatusChange?: (status: AudioPlayerStatus) => void;
  onError?: (error: Error) => void;
}

export class AudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private currentSessionId: string | null = null;
  private status: AudioPlayerStatus = "idle";
  private events: AudioPlayerEvents;

  constructor(events?: AudioPlayerEvents) {
    this.events = events || {};
  }

  public getStatus(): AudioPlayerStatus {
    return this.status;
  }

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  /**
   * Plays the given audio URL within a specific session token.
   * If an existing audio is playing, it is stopped and cleaned up first.
   */
  public async play(audioUrl: string, sessionId: string): Promise<void> {
    this.stop();

    this.currentSessionId = sessionId;
    this.currentUrl = audioUrl;

    const audio = new Audio(audioUrl);
    this.currentAudio = audio;

    audio.onended = () => {
      if (this.currentSessionId === sessionId) {
        this.status = "ended";
        this.events.onStatusChange?.("ended");
      }
    };

    audio.onerror = (e) => {
      if (this.currentSessionId === sessionId) {
        this.status = "error";
        const err = new Error(
          audio.error?.message || "Audio playback encountered an error",
        );
        this.events.onError?.(err);
        this.events.onStatusChange?.("error");
      }
    };

    audio.onpause = () => {
      if (this.currentSessionId === sessionId && this.status === "playing") {
        this.status = "paused";
        this.events.onStatusChange?.("paused");
      }
    };

    audio.onplay = () => {
      if (this.currentSessionId === sessionId) {
        this.status = "playing";
        this.events.onStatusChange?.("playing");
      }
    };

    try {
      await audio.play();
    } catch (err: unknown) {
      if (this.currentSessionId === sessionId) {
        this.status = "error";
        const playErr =
          err instanceof Error
            ? err
            : new Error("Failed to start audio playback");
        this.events.onError?.(playErr);
        this.events.onStatusChange?.("error");
      }
    }
  }

  public pause(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.status = "paused";
      this.events.onStatusChange?.("paused");
    }
  }

  public resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch((err) => {
        this.status = "error";
        this.events.onError?.(
          err instanceof Error ? err : new Error("Failed to resume playback"),
        );
        this.events.onStatusChange?.("error");
      });
    }
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onpause = null;
      this.currentAudio.onplay = null;
      this.currentAudio = null;
    }
    this.status = "idle";
    this.events.onStatusChange?.("idle");
  }

  public replay(): void {
    if (this.currentAudio) {
      this.currentAudio.currentTime = 0;
      this.currentAudio.play().catch((err) => {
        this.status = "error";
        this.events.onError?.(
          err instanceof Error ? err : new Error("Failed to replay audio"),
        );
      });
    }
  }

  public cleanup(): void {
    this.stop();
    if (this.currentUrl && this.currentUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(this.currentUrl);
      } catch {
        // Safe ignore
      }
      this.currentUrl = null;
    }
    this.currentSessionId = null;
  }
}
