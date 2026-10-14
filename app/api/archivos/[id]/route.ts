import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTaskId as parseId } from "@/lib/tasks/validation";
import { FILES_BUCKET } from "@/lib/university/files";

/** Opens a subject document: RLS finds the caller's row, then a 60-second signed URL. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/archivos/[id]">) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { data: file } = await supabase.from("subject_files").select("storage_path,name").eq("id", id).maybeSingle();
  if (!file) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: false });
  if (error || !data) return NextResponse.json({ error: "No se ha podido abrir." }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
