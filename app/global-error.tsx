"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed, so there is no app shell, no
 * fonts, and no stylesheet to rely on — `global-error` replaces `<html>`
 * entirely. Everything here is inline for that reason.
 *
 * Without this file, a root-level failure shows Next's own default error page,
 * which is unstyled and mentions the framework.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#faf8f5",
          color: "#2d2926",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Regroup is temporarily unavailable
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#6b655f" }}>
            We&rsquo;re having trouble loading the app. Please try again in a
            moment.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "1rem",
                fontSize: "0.6875rem",
                color: "#6b655f",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#1e293b",
              color: "#faf8f5",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
