export default function DashboardBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -my-6 h-[calc(100dvh-3.5rem)] overflow-hidden sm:-mx-6 lg:-mx-8 lg:-my-8">
      {children}
    </div>
  );
}