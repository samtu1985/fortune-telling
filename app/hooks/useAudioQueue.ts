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
      URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.onerror = () => {
      console.warn("[audio] Playback error, skipping segment");
      URL.revokeObjectURL(segment.audioUrl);
      playNext();
    };

    audio.play().catch((err) => {
      console.warn("[audio] Play failed (mobile restriction?):", err);
      // On mobile, auto-play might be blocked. Skip to next.
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

  // Download all segments as a single WAV podcast
  // MP3 concatenation doesn't produce valid files for all players.
  // Instead, decode all MP3 segments via AudioContext, merge PCM, encode as WAV.
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

      // Encode as WAV
      const wavBlob = encodeWAV(merged);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fortunefor-me-podcast-${new Date().toISOString().slice(0, 10)}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      audioCtx.close();
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
    currentMaster,
    pause,
    resume,
    stop,
    allSegments: allSegmentsRef.current,
    hasSegments: allSegmentsRef.current.length > 0,
    downloadPodcast,
    podcastDownloading,
  };
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
