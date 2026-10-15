import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { login } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold">Entra en Atlas</h1>
        <p className="text-base text-muted">Tus tareas y apuntes te esperan.</p>
      </header>
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-accent-ink">
          Crea una
        </Link>
      </p>
    </>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { aviso } = await searchParams;
  return (
    <AuthForm
      action={login}
      submitLabel="Entrar"
      pendingLabel="Entrando…"
      passwordAutoComplete="current-password"
      initialError={
        aviso === "enlace-invalido"
          ? "El enlace de confirmación no es válido o ha caducado. Prueba a registrarte de nuevo."
          : undefined
      }
      initialMessage={
        aviso === "correo-confirmado" ? "Tu correo está confirmado. Ya puedes entrar." : undefined
      }
    />
  );
}

function FormSkeleton() {
  return <div aria-hidden className="h-72 rounded-atlas border border-line" />;
}
