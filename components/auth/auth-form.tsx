"use client";

import { useActionState } from "react";
import { Field, FormError, inputClass, primaryButtonClass } from "@/components/ui/form";
import { MIN_PASSWORD_LENGTH, type AuthFormState } from "@/lib/auth/validation";

type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  initialError?: string;
  initialMessage?: string;
};

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  initialError,
  initialMessage,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {
    error: initialError,
    message: initialMessage,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field label="Correo" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          required
          minLength={MIN_PASSWORD_LENGTH}
          className={inputClass}
        />
      </Field>

      <FormError message={state.error} />
      {state.message && (
        <p role="status" className="text-sm text-accent-ink">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
