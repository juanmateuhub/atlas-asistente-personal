export const MIN_PASSWORD_LENGTH = 8;

export type AuthFormState = {
  error?: string;
  message?: string;
  email?: string;
};

export type Credentials = { email: string; password: string };

export function parseCredentials(
  formData: FormData,
): { ok: true; value: Credentials } | { ok: false; error: string; email: string } {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Introduce un correo válido.", email };
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
    return {
      ok: false,
      error: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 72 caracteres.`,
      email,
    };
  }
  return { ok: true, value: { email, password } };
}

/** Maps Supabase Auth error codes to Spanish messages without leaking internals. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo.";
    case "weak_password":
      return "La contraseña es demasiado débil. Prueba con una más larga.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
    default:
      return "No se ha podido completar. Inténtalo de nuevo.";
  }
}
