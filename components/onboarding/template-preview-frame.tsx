export function TemplatePreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[420px] overflow-hidden rounded-t-lg border-b border-border bg-surface">
      <div className="pointer-events-none w-[285.7%] origin-top-left scale-[0.35]">
        {children}
      </div>
    </div>
  );
}
