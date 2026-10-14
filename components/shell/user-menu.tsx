import { SignOut } from "@phosphor-icons/react/ssr";
import { logout } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth/user";

/** Two letters for the avatar, from the email's local part ("juan.mateu" → "JM"). */
export function initials(email: string | null): string {
  const local = (email ?? "").split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.replace(/[^A-Za-z]/g, "").slice(0, 2);
  return (letters || "?").toUpperCase();
}

/** Reads the session: render inside a Suspense boundary. */
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();

  return (
    <form action={logout} className={`flex items-center gap-[10px] ${compact ? "" : "p-[10px]"}`}>
      {!compact && (
        <>
          <span className="grid size-[30px] flex-none place-items-center rounded-full bg-neutral-800 text-[12px] font-medium text-neutral-200">
            {initials(user.email)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-400" title={user.email ?? undefined}>
            {user.email}
          </span>
        </>
      )}
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="grid size-[30px] place-items-center rounded-md text-neutral-500 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-neutral-300"
      >
        <SignOut size={17} />
      </button>
    </form>
  );
}
