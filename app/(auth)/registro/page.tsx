import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signup } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold">Crea tu cuenta</h1>
        <p className="text-base text-muted">Tus datos son privados y solo tú puedes verlos.</p>
      </header>
      <AuthForm
        action={signup}
        submitLabel="Crear cuenta"
        pendingLabel="Creando…"
        passwordAutoComplete="new-password"
      />
      <p className="text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-accent">
          Entra
        </Link>
      </p>
    </>
  );
}
