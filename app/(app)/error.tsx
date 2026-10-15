"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { primaryButtonClass } from "@/components/ui/form";

/**
 * Error boundary for authenticated pages. Server error messages are not shown:
 * in production Next redacts them, and they may contain internals.
 */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section
      role="alert"
      className="flex animate-enter flex-col items-center gap-4 rounded-atlas bg-line/15 px-6 py-12 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-surface">
        <TriangleAlert aria-hidden className="size-7 text-accent-ink" />
      </span>
      <h1 className="text-lead font-medium">No se ha podido cargar esta página</h1>
      <p className="max-w-md text-base text-muted">
        Puede ser un problema de conexión o del servidor. Tus datos no se han perdido.
      </p>
      <button type="button" onClick={retry} className={`${primaryButtonClass} inline-flex items-center gap-2`}>
        <RotateCw aria-hidden className="size-5" />
        Reintentar
      </button>
    </section>
  );
}
