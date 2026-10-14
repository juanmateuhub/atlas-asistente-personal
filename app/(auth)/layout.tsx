export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-atlas border border-line p-8">
        {children}
      </div>
    </main>
  );
}
