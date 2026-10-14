import { Home } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function InicioPage() {
  return (
    <>
      <PageHeader title="Inicio" lead="Tu día, de un vistazo." />
      <EmptyState
        icon={Home}
        title="Todavía no hay nada que resumir"
        description="Cuando añadas tareas y asignaturas, aquí verás lo que tienes pendiente hoy."
      />
    </>
  );
}
