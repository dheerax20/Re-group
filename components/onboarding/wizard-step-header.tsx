export function WizardStepHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-2 border-b border-border pb-6">
      <h1 className="font-serif text-[1.85rem] font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
