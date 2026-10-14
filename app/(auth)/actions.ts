"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorMessage, parseCredentials, type AuthFormState } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (!parsed.ok) return { error: parsed.error, email: parsed.email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.value);
  if (error) return { error: authErrorMessage(error.code), email: parsed.value.email };

  redirect("/");
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (!parsed.ok) return { error: parsed.error, email: parsed.email };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.value,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });
  if (error) return { error: authErrorMessage(error.code), email: parsed.value.email };

  if (!data.session) {
    return {
      message: "Te hemos enviado un correo. Abre el enlace para activar tu cuenta.",
      email: parsed.value.email,
    };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
