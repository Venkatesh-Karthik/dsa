/**
 * Bounded Voice Cache for Cognora
 *
 * Caches synthesized speech audio keyed by composite identifiers:
 * (lessonId, transformationId, speechHash, provider, voiceId).
 * Automatically evicts older entries and revokes Object URLs to prevent memory leaks.
 */

import type { TTSAudio } from "./voice-contract";

export interface CacheEntry {
  key: string;
  audio: TTSAudio;
  timestamp: number;
}

export class VoiceCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }

  public static generateKey(
    lessonId: string,
    transformationId: string,
    spokenText: string,
    provider: string = "chatterbox",
    voiceId: string = "default",
  ): string {
    const hash = this.simpleHash(spokenText);
    return `${lessonId}:${transformationId}:${hash}:${provider}:${voiceId}`;
  }

  public get(key: string): TTSAudio | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Refresh LRU position
    this.cache.delete(key);
    entry.timestamp = Date.now();
    this.cache.set(key, entry);
    return entry.audio;
  }

  public getByTransformation(
    lessonId: string,
    transformationId: string,
  ): TTSAudio | null {
    const prefix = `${lessonId}:${transformationId}:`;
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        return entry.audio;
      }
    }
    return null;
  }

  public set(key: string, audio: TTSAudio): void {
    if (this.cache.has(key)) {
      const old = this.cache.get(key);
      if (old?.audio.audioUrl && old.audio.audioUrl !== audio.audioUrl) {
        this.revokeUrl(old.audio.audioUrl);
      }
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry?.audio.audioUrl) {
          this.revokeUrl(oldestEntry.audio.audioUrl);
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      key,
      audio,
      timestamp: Date.now(),
    });
  }

  public clear(): void {
    for (const entry of this.cache.values()) {
      if (entry.audio.audioUrl) {
        this.revokeUrl(entry.audio.audioUrl);
      }
    }
    this.cache.clear();
  }

  private revokeUrl(url: string): void {
    if (url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe ignore
      }
    }
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
