import { GoogleLogo, WarningCircle } from "@phosphor-icons/react/ssr";
import type { CalendarSyncStatus } from "@/lib/calendar/google-sync";

const TEXT: Partial<Record<CalendarSyncStatus, { message: string; action?: string }>> = {
  "no-permission": {
    message: "Conecta Google Calendar para ver aquí tus eventos de la UJI y llevar allí los de Atlas.",
    action: "Dar permiso de calendario",
  },
  "more-calendars": {
    message: "Para ver también tus clases y otros calendarios de Google (como «Les teues classes»), da permiso para leer tu lista de calendarios.",
    action: "Ver todos mis calendarios",
  },
  expired: { message: "Google ha caducado el acceso. Vuelve a conectar tu cuenta.", action: "Volver a conectar" },
  error: { message: "Google Calendar no ha respondido. Lo intento de nuevo en unos minutos." },
};

/** One line above the calendar when the Google sync needs the user. Nothing when it works or there's no account. */
export function GoogleCalendarNotice({ status }: { status: CalendarSyncStatus }) {
  const text = TEXT[status];
  if (!text) return null;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-surface px-5 py-4">
      <p role="status" className="m-0 flex min-w-0 flex-1 items-center gap-[10px] text-[14px] text-neutral-300">
        <WarningCircle size={18} color="var(--color-accent-ink)" className="flex-none" />
        {text.message}
      </p>
      {text.action && (
        // Plain <a>: the route redirects to Google.
        <a
          href="/api/correo/conectar"
          className="pressable inline-flex h-[40px] flex-none items-center gap-2 rounded-full bg-accent px-[18px] text-[14px] font-semibold text-on-accent transition-[background,scale] hover:bg-accent-500"
        >
          <GoogleLogo size={16} weight="bold" />
          {text.action}
        </a>
      )}
    </div>
  );
}
