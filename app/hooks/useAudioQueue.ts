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
  const [isPaused, setIsPaused] = useState(false);
  const [currentMaster, setCurrentMaster] = useState<MasterType | null>(null);
  const [waitingForTap, setWaitingForTap] = useState(false);
  // Reactive count of fully enqueued segments. Callers use this to know when
  // every expected segment has arrived (e.g. to only expose the download
  // button after all three masters' audio is ready).
  const [segmentCount, setSegmentCount] = useState(0);
  const queueRef = useRef<AudioSegment[]>([]);
  const allSegmentsRef = useRef<AudioSegment[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const startedRef = useRef(false); // true after user taps to start

  // Play next segment in queue
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentMaster(null);
      playingRef.current = false;
      return;
    }

    const segment = queueRef.current.shift()!;
    setCurrentMaster(segment.masterKey);
    setIsPlaying(true);
    setIsPaused(false);
    playingRef.current = true;

    const audio = new Audio(segment.audioUrl);
    audioRef.current = audio;
    const startedAt = performance.now();

    audio.onloadedmetadata = () => {
      console.log(
        "[audio] metadata loaded",
        segment.masterKey,
        "duration:",
        audio.duration,
        "buffer bytes:",
        segment.audioBuffer.byteLength
      );
    };

    audio.onended = () => {
      const playedMs = Math.round(performance.now() - startedAt);
      console.log("[audio] ended", segment.masterKey, "playedMs:", playedMs);
      URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.onerror = () => {
      const mediaErr = audio.error;
      const playedMs = Math.round(performance.now() - startedAt);
      console.error(
        "[audio] PLAYBACK ERROR",
        segment.masterKey,
        "code:",
        mediaErr?.code,
        "message:",
        mediaErr?.message,
        "src:",
        segment.audioUrl,
        "bufferBytes:",
        segment.audioBuffer.byteLength,
        "playedMs:",
        playedMs
      );
      URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.play()
      .then(() => {
        console.log("[audio] playing", segment.masterKey);
      })
      .catch((err) => {
        console.error(
          "[audio] play() rejected for",
          segment.masterKey,
          err?.name,
          err?.message
        );
        URL.revokeObjectURL(segment.audioUrl);
        playNext();
      });
  }, []);

  // User taps to start playback — this is a direct user gesture, always works
  const startPlayback = useCallback(() => {
    startedRef.current = true;
    setWaitingForTap(false);
    playNext();
  }, [playNext]);

  // Enqueue a new audio segment
  const enqueue = useCallback(
    (segment: AudioSegment) => {
      allSegmentsRef.current.push(segment);
      queueRef.current.push(segment);
      setSegmentCount(allSegmentsRef.current.length);

      if (startedRef.current) {
        // User already tapped — auto-play subsequent segments
        if (!playingRef.current) {
          playNext();
        }
      } else {
        // First segment arrived — wait for user tap
        setWaitingForTap(true);
      }
    },
    [playNext]
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    queueRef.current = [];
    allSegmentsRef.current = [];
    setSegmentCount(0);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentMaster(null);
    playingRef.current = false;
    startedRef.current = false;
    setWaitingForTap(false);
  }, []);

  // Download all segments as a single WAV podcast.
  //
  // Pipeline:
  //   1. Decode each MP3 segment to PCM via AudioContext.decodeAudioData
  //   2. Concatenate the PCM frames in order into a single AudioBuffer
  //   3. Encode that buffer as a 16-bit WAV blob
  //
  // We used to try an ffmpeg.wasm WAV→M4A conversion for smaller files, but
  // it produced malformed M4A containers that some players (macOS Music,
  // QuickTime) refused to open — and the 26 MB ffmpeg WASM binary was a
  // heavy price for a conversion that could fail silently. WAV is ~10× larger
  // than M4A for the same audio but it plays everywhere, every time.
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

      const wavBlob = encodeWAV(merged);
      audioCtx.close();

      triggerDownload(
        wavBlob,
        `fortunefor-me-podcast-${new Date().toISOString().slice(0, 10)}.wav`,
      );
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
        URL.revokeObjectURL(segment.audioUrl);
      }
    };
  }, []);

  return {
    enqueue,
    isPlaying,
    isPaused,
    currentMaster,
    waitingForTap,
    startPlayback,
    pause,
    resume,
    stop,
    allSegments: allSegmentsRef.current,
    hasSegments: segmentCount > 0,
    segmentCount,
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
