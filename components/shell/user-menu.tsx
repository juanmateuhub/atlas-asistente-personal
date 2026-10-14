import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth/user";

/** Reads the session: render inside a Suspense boundary. */
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();

  return (
    <form action={logout} className="flex items-center gap-2">
      {!compact && (
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={user.email ?? undefined}>
          {user.email}
        </span>
      )}
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="flex size-10 items-center justify-center rounded-atlas text-muted hover:bg-raised hover:text-white"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </form>
  );
}
