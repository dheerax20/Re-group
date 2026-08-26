"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The camera.
 *
 * Full-bleed and black, with the frame cut out of a dimmed overlay — the only
 * thing on screen is the thing the volunteer is pointing at a ticket. Every
 * statistic, table and card that used to surround the viewfinder has been moved
 * off this view entirely, because a person scanning a queue is looking at the
 * ticket, not at our dashboard.
 *
 * The decode loop and the camera lifecycle are unchanged from the original
 * station: jsQR imported dynamically so its decoder never enters the bundle of
 * a screen that is not scanning, run against a downscaled canvas at ~10fps
 * rather than every frame (a phone held up for a long queue gets hot and flat
 * otherwise), with a repeat-suppression window so one ticket held in frame
 * cannot fire a mutation per frame.
 */
export function QrScanner({
  active,
  onDecode,
  onClose,
  paused,
  className,
}: {
  /** Whether the camera should be running. */
  active: boolean;
  onDecode: (raw: string) => void;
  onClose: () => void;
  /** Decoding stops while a result is on screen, so it cannot scan behind it. */
  paused?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const pausedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  // Mirrored into a ref so the decode loop can read the latest value without
  // being torn down and restarted every time a result appears.
  useEffect(() => {
    pausedRef.current = Boolean(paused);
  }, [paused]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchAvailable(false);
    setReady(false);
  }, []);

  useEffect(() => {
    // Nothing to start, and nothing to tear down that the previous run's
    // cleanup has not already handled. Stopping the camera here instead would
    // be a synchronous setState inside an effect body.
    if (!active) return;

    let cancelled = false;

    async function start() {
      /**
       * `getUserMedia` only exists in a secure context. On plain HTTP over a
       * LAN IP — exactly how someone tests this from their phone — the API is
       * simply absent, and without this the screen is a dead black box.
       */
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext === false
            ? "The camera needs a secure connection (https). Use manual check-in instead."
            : "This browser can't open the camera. Use manual check-in instead."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Rear camera, at a resolution where a QR on a phone screen resolves
          // without asking the volunteer to hold it uncomfortably close.
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(capabilities?.torch));

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in your browser settings, or use manual check-in."
            : name === "NotFoundError"
              ? "No camera found on this device. Use manual check-in instead."
              : "Could not start the camera. Use manual check-in instead."
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let decode: typeof import("jsqr").default | null = null;
    let lastRun = 0;

    void import("jsqr").then((mod) => {
      decode = mod.default;
    });

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (cancelled || !decode || pausedRef.current || now - lastRun < 100) return;
      lastRun = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const width = Math.min(video.videoWidth, 640);
      if (!width) return;
      const height = Math.round((video.videoHeight / video.videoWidth) * width);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);

      const image = ctx.getImageData(0, 0, width, height);
      const found = decode(image.data, width, height, { inversionAttempts: "dontInvert" });
      if (!found?.data) return;

      const last = lastScanRef.current;
      // Same ticket still in frame — ignore for a few seconds so one person
      // does not generate a stream of "already checked in".
      if (last && last.value === found.data && now - last.at < 4000) return;
      lastScanRef.current = { value: found.data, at: now };

      onDecode(found.data);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ready, onDecode]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  return (
    <div className={cn("relative flex size-full flex-col bg-black", className)}>
      <video
        className={cn("absolute inset-0 size-full object-cover", !ready && "invisible")}
        muted
        playsInline
        ref={videoRef}
      />
      <canvas className="hidden" ref={canvasRef} />

      {ready ? (
        // The frame is a hole punched in a dimmed overlay by a very large ring
        // shadow — one element, no masks, and it scales to any viewport.
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-60 rounded-3xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] sm:size-72" />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <CameraOff className="size-7 text-white/60" />
          <p className="max-w-xs text-[13px] leading-relaxed text-white/80">
            {error ?? "Starting the camera…"}
          </p>
        </div>
      )}

      {/* Controls float over the preview, above the safe area on a phone. */}
      <div className="relative z-10 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button
          aria-label="Close scanner"
          className="size-10 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="size-5" />
        </Button>

        {torchAvailable ? (
          <Button
            aria-label="Toggle light"
            aria-pressed={torchOn}
            className={cn(
              "size-10 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white",
              torchOn && "bg-white text-black hover:bg-white hover:text-black"
            )}
            onClick={toggleTorch}
            size="icon"
            variant="ghost"
          >
            <Flashlight className="size-5" />
          </Button>
        ) : null}
      </div>

      <div className="relative z-10 mt-auto px-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-[13px] leading-relaxed text-white/85">
          Point the camera at the attendee&rsquo;s QR ticket.
        </p>
      </div>
    </div>
  );
}
