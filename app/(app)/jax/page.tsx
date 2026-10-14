import type { Metadata } from "next";
import { Suspense } from "react";
import { JaxChat } from "@/components/jax/jax-chat";
import { getCurrentUser } from "@/lib/auth/user";
import { listConversation } from "@/lib/jax/conversation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Jax" };

export default function JaxPage() {
  return (
    <Suspense fallback={<div aria-hidden className="h-64 animate-skeleton rounded-atlas bg-line/20" />}>
      <Conversation />
    </Suspense>
  );
}

async function Conversation() {
  await getCurrentUser();
  const supabase = await createClient();
  const messages = await listConversation(supabase);
  return <JaxChat initialMessages={messages} />;
}
