export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        The page you&apos;re looking for doesn&apos;t exist. Use the menu to pick up
        where you left off.
      </p>
    </div>
  );
}
