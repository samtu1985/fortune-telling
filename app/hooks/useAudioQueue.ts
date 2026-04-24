"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type MasterType = "bazi" | "ziwei" | "zodiac" | "humandesign";

export interface AudioSegment {
  masterKey: MasterType;
  audioUrl: string;
  audioBuffer: ArrayBuffer;
}

// Internal slot representation. `id` is assigned in reserve() call order and is
// how fulfill() and playback locate the slot. `segment` is null until the TTS
// fetch completes. Playback is strictly ordered by slot id — so even if TTS
// arrival order is (ziwei, bazi, …) because ziwei synthesized faster, playback
// still follows the reservation order (bazi, ziwei, …).
interface Slot {
  id: number;
  segment: AudioSegment | null;
}

export function useAudioQueue() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentMaster, setCurrentMaster] = useState<MasterType | null>(null);
  const [waitingForTap, setWaitingForTap] = useState(false);
  // Reactive count of fully fulfilled segments. Callers use this to know when
  // every expected segment has arrived (e.g. to only expose the download
  // button after all masters' audio is ready).
  const [segmentCount, setSegmentCount] = useState(0);

  // Ordered list of reserved slots. A slot is created (empty) when a master
  // starts speaking, and filled later when its TTS arrives. Playback iterates
  // this list in order; if the next slot is unfulfilled we pause playback and
  // resume automatically as soon as fulfill() is called for that slot.
  const slotsRef = useRef<Slot[]>([]);
  const nextSlotIdRef = useRef(0);
  const playheadRef = useRef(0); // index into slotsRef of the next slot to play
  const allSegmentsRef = useRef<AudioSegment[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const startedRef = useRef(false); // true after user taps to start
  const waitingForSlotRef = useRef(false); // true when playback is stalled waiting for the next reserved slot to fulfill

  // Forward reference so fulfill/enqueue can call playNext without React
  // dependency ordering pain (playNext also needs to read these refs).
  const playNextRef = useRef<() => void>(() => {});

  // Play the slot at playheadRef. If it's not yet fulfilled, mark as waiting
  // and return — fulfill() will kick playback back off once the slot lands.
  const playNext = useCallback(() => {
    const slots = slotsRef.current;
    const idx = playheadRef.current;

    if (idx >= slots.length) {
      // No more reserved slots. Idle until more come in (or stay idle if all
      // done).
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentMaster(null);
      playingRef.current = false;
      waitingForSlotRef.current = false;
      return;
    }

    const slot = slots[idx];
    if (!slot.segment) {
      // Next slot is reserved but its TTS hasn't arrived yet. Pause — fulfill
      // will call playNext again once this slot is filled.
      waitingForSlotRef.current = true;
      playingRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentMaster(null);
      return;
    }

    const segment = slot.segment;
    waitingForSlotRef.current = false;
    playheadRef.current = idx + 1;
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
        "slot:",
        slot.id,
        "duration:",
        audio.duration,
        "buffer bytes:",
        segment.audioBuffer.byteLength
      );
    };

    audio.onended = () => {
      const playedMs = Math.round(performance.now() - startedAt);
      console.log("[audio] ended", segment.masterKey, "slot:", slot.id, "playedMs:", playedMs);
      URL.revokeObjectURL(segment.audioUrl);
      playNextRef.current();
    };

    audio.onerror = () => {
      const mediaErr = audio.error;
      const playedMs = Math.round(performance.now() - startedAt);
      console.error(
        "[audio] PLAYBACK ERROR",
        segment.masterKey,
        "slot:",
        slot.id,
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
      playNextRef.current();
    };

    audio.play()
      .then(() => {
        console.log("[audio] playing", segment.masterKey, "slot:", slot.id);
      })
      .catch((err) => {
        console.error(
          "[audio] play() rejected for",
          segment.masterKey,
          err?.name,
          err?.message
        );
        URL.revokeObjectURL(segment.audioUrl);
        playNextRef.current();
      });
  }, []);

  // Keep the ref in sync so the audio element callbacks (which close over
  // playNextRef, not playNext) always see the latest implementation.
  playNextRef.current = playNext;

  // User taps to start playback — this is a direct user gesture, always works
  const startPlayback = useCallback(() => {
    startedRef.current = true;
    setWaitingForTap(false);
    playNext();
  }, [playNext]);

  // Reserve a slot for a master that is ABOUT to speak. Returns an opaque slot
  // id; callers must pass this id to fulfill() once the TTS audio arrives.
  // Reservation order = playback order.
  const reserve = useCallback((): number => {
    const id = nextSlotIdRef.current++;
    slotsRef.current.push({ id, segment: null });
    // First reservation in podcast mode — surface the tap-to-start UI. We
    // don't actually start playback yet; we wait for either the user tap or
    // for the first slot to fulfill.
    if (!startedRef.current && slotsRef.current.length === 1) {
      setWaitingForTap(true);
    }
    return id;
  }, []);

  // Fill a previously reserved slot with its TTS audio. Triggers playback if
  // we were stalled waiting for this slot.
  const fulfill = useCallback(
    (slotId: number, segment: AudioSegment) => {
      const slot = slotsRef.current.find((s) => s.id === slotId);
      if (!slot) {
        console.warn(
          "[audio] fulfill called for unknown slot",
          slotId,
          "— discarding and revoking url"
        );
        URL.revokeObjectURL(segment.audioUrl);
        return;
      }
      if (slot.segment) {
        console.warn(
          "[audio] slot",
          slotId,
          "already fulfilled — ignoring duplicate"
        );
        URL.revokeObjectURL(segment.audioUrl);
        return;
      }
      slot.segment = segment;
      allSegmentsRef.current.push(segment);
      setSegmentCount(allSegmentsRef.current.length);

      // If playback was stalled on THIS slot, resume now. If we haven't
      // started at all, wait for the user tap.
      if (startedRef.current && !playingRef.current && waitingForSlotRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  // Backwards-compat convenience: reserve + fulfill in a single call. Used for
  // audio that arrives without a prior reservation (defensive — podcast mode
  // should always reserve first).
  const enqueue = useCallback(
    (segment: AudioSegment) => {
      const id = nextSlotIdRef.current++;
      slotsRef.current.push({ id, segment });
      allSegmentsRef.current.push(segment);
      setSegmentCount(allSegmentsRef.current.length);

      if (startedRef.current) {
        if (!playingRef.current) {
          playNext();
        }
      } else {
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
    // Revoke any object URLs we still hold — for fulfilled slots not yet played
    // and for segments that were passed through enqueue directly.
    for (const slot of slotsRef.current) {
      if (slot.segment) {
        try { URL.revokeObjectURL(slot.segment.audioUrl); } catch { /* noop */ }
      }
    }
    slotsRef.current = [];
    nextSlotIdRef.current = 0;
    playheadRef.current = 0;
    allSegmentsRef.current = [];
    waitingForSlotRef.current = false;
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
    // Download uses slot order (speaking order) rather than arrival order so
    // the exported podcast matches what the user heard.
    const segments = slotsRef.current
      .map((s) => s.segment)
      .filter((s): s is AudioSegment => s !== null);
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
      for (const slot of slotsRef.current) {
        if (slot.segment) {
          try { URL.revokeObjectURL(slot.segment.audioUrl); } catch { /* noop */ }
        }
      }
    };
  }, []);

  return {
    enqueue,
    reserve,
    fulfill,
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
