"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type MasterType = "bazi" | "ziwei" | "zodiac";

export interface AudioSegment {
  masterKey: MasterType;
  audioUrl: string;
  audioBuffer: ArrayBuffer;
}

export function useAudioQueue() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMaster, setCurrentMaster] = useState<MasterType | null>(null);
  const queueRef = useRef<AudioSegment[]>([]);
  const allSegmentsRef = useRef<AudioSegment[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock audio on iOS Safari using AudioContext.resume()
  // This is the most reliable method — once resumed in a user gesture,
  // ALL audio on the page (including HTMLAudioElement) is permanently unlocked.
  const unlockAudio = useCallback(() => {
    // Method 1: AudioContext resume (unlocks all audio on the page)
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().then(() => {
          console.log("[audio] AudioContext resumed — audio unlocked");
        });
      }
    } catch { /* ignore */ }

    // Method 2: Also play a silent Audio element as backup
    try {
      const a = new Audio();
      a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      a.volume = 0;
      a.play().then(() => a.remove()).catch(() => {});
    } catch { /* ignore */ }

    console.log("[audio] unlockAudio called");
  }, []);

  // Play next segment in queue
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setCurrentMaster(null);
      playingRef.current = false;
      return;
    }

    const segment = queueRef.current.shift()!;
    setCurrentMaster(segment.masterKey);
    setIsPlaying(true);
    playingRef.current = true;

    const audio = new Audio(segment.audioUrl);
    audioRef.current = audio;

    audio.onended = () => {
      if (segment.audioUrl.startsWith("blob:")) URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.onerror = () => {
      console.warn("[audio] Playback error, skipping segment");
      if (segment.audioUrl.startsWith("blob:")) URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.play().catch((err) => {
      console.warn("[audio] Play failed:", err);
      if (segment.audioUrl.startsWith("blob:")) URL.revokeObjectURL(segment.audioUrl);
      playNext();
    });
  }, []);

  // Enqueue a new audio segment
  const enqueue = useCallback(
    (segment: AudioSegment) => {
      allSegmentsRef.current.push(segment);
      queueRef.current.push(segment);

      // Start playing if not already
      if (!playingRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    queueRef.current = [];
    allSegmentsRef.current = [];
    setIsPlaying(false);
    setCurrentMaster(null);
    playingRef.current = false;
  }, []);

  // Download all segments as M4A podcast
  // 1. Decode MP3 segments → PCM via AudioContext
  // 2. Encode as WAV (intermediate)
  // 3. Convert WAV → M4A via ffmpeg.wasm for smaller file size
  const [podcastDownloading, setPodcastDownloading] = useState(false);

  const downloadPodcast = useCallback(async () => {
    const segments = allSegmentsRef.current;
    if (segments.length === 0) return;

    setPodcastDownloading(true);
    try {
      const audioCtx = new AudioContext();

      // Decode all MP3 segments to AudioBuffers
      const decoded: AudioBuffer[] = [];
      for (const segment of segments) {
        const buf = await audioCtx.decodeAudioData(segment.audioBuffer.slice(0));
        decoded.push(buf);
      }

      // Calculate total length
      const sampleRate = decoded[0].sampleRate;
      const numChannels = decoded[0].numberOfChannels;
      const totalFrames = decoded.reduce((sum, b) => sum + b.length, 0);

      // Merge into single buffer
      const merged = audioCtx.createBuffer(numChannels, totalFrames, sampleRate);
      let writeOffset = 0;
      for (const buf of decoded) {
        for (let ch = 0; ch < numChannels; ch++) {
          merged.getChannelData(ch).set(buf.getChannelData(ch), writeOffset);
        }
        writeOffset += buf.length;
      }

      // Encode as WAV first
      const wavBlob = encodeWAV(merged);
      audioCtx.close();

      // Convert WAV → M4A via ffmpeg.wasm
      try {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        const { fetchFile } = await import("@ffmpeg/util");

        const ffmpeg = new FFmpeg();
        await ffmpeg.load();

        const wavData = await fetchFile(wavBlob);
        await ffmpeg.writeFile("input.wav", wavData);
        await ffmpeg.exec(["-i", "input.wav", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "output.m4a"]);
        const outputData = await ffmpeg.readFile("output.m4a");
        ffmpeg.terminate();

        const m4aBlob = new Blob([outputData as BlobPart], { type: "audio/mp4" });
        triggerDownload(m4aBlob, `fortunefor-me-podcast-${new Date().toISOString().slice(0, 10)}.m4a`);
      } catch (ffmpegErr) {
        // Fallback to WAV if ffmpeg.wasm fails (e.g., on some mobile browsers)
        console.warn("[audio] ffmpeg.wasm failed, falling back to WAV:", ffmpegErr);
        triggerDownload(wavBlob, `fortunefor-me-podcast-${new Date().toISOString().slice(0, 10)}.wav`);
      }
    } catch (e) {
      console.error("[audio] Failed to generate podcast:", e);
    } finally {
      setPodcastDownloading(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      for (const segment of queueRef.current) {
        if (segment.audioUrl.startsWith("blob:")) URL.revokeObjectURL(segment.audioUrl);
      }
    };
  }, []);

  return {
    enqueue,
    isPlaying,
    currentMaster,
    pause,
    resume,
    stop,
    unlockAudio,
    allSegments: allSegmentsRef.current,
    hasSegments: allSegmentsRef.current.length > 0,
    downloadPodcast,
    podcastDownloading,
  };
}

// ─── Download Helper ────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── WAV Encoding Helpers ───────────────────────────────

/** Encode an AudioBuffer to a WAV Blob */
function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Interleave channels and write PCM data
  let offset = headerLength;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
