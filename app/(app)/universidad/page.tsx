import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Universidad" };

export default function UniversidadPage() {
  return (
    <>
      <PageHeader title="Universidad" lead="Asignaturas, temas y apuntes." />
      <EmptyState
        icon={BookOpen}
        title="Sin asignaturas"
        description="Aquí podrás organizar tus asignaturas por temas y escribir tus apuntes."
      />
    </>
  );
}
