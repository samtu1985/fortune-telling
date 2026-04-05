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

  // Download all segments as a single podcast MP3
  const downloadPodcast = useCallback(() => {
    const segments = allSegmentsRef.current;
    if (segments.length === 0) return;

    // Concatenate all ArrayBuffers
    const totalLength = segments.reduce((sum, s) => sum + s.audioBuffer.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const segment of segments) {
      combined.set(new Uint8Array(segment.audioBuffer), offset);
      offset += segment.audioBuffer.byteLength;
    }

    const blob = new Blob([combined], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fortunefor-me-podcast-${new Date().toISOString().slice(0, 10)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Revoke any remaining object URLs
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
  };
}
