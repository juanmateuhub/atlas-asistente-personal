import { Field, inputClass } from "@/components/ui/form";
import type { Exam, Subject } from "@/lib/university/types";
import { DESCRIPTION_MAX, LOCATION_MAX, NAME_MAX, TITLE_MAX } from "@/lib/university/validation";

export function SubjectFields({ idPrefix, subject }: { idPrefix: string; subject?: Subject }) {
  return (
    <>
      <Field label="Nombre" htmlFor={`${idPrefix}-name`}>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={NAME_MAX}
          defaultValue={subject?.name}
          placeholder="Ej. Redes de Computadores"
          className={inputClass}
        />
      </Field>
      <Field label="Descripción" htmlFor={`${idPrefix}-description`} hint="Opcional: profesor, aula, horario…">
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          defaultValue={subject?.description ?? ""}
          className={inputClass}
        />
      </Field>
    </>
  );
}

export function ExamFields({ idPrefix, exam }: { idPrefix: string; exam?: Exam }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <>
      <Field label="Título" htmlFor={id("title")}>
        <input
          id={id("title")}
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={exam?.title}
          placeholder="Ej. Primer parcial"
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor={id("date")}>
          <input id={id("date")} name="date" type="date" required defaultValue={exam?.date} className={inputClass} />
        </Field>
        <Field label="Hora" htmlFor={id("time")} hint="Opcional">
          <input id={id("time")} name="time" type="time" defaultValue={exam?.time ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Lugar" htmlFor={id("location")} hint="Opcional">
          <input
            id={id("location")}
            name="location"
            maxLength={LOCATION_MAX}
            defaultValue={exam?.location ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Nota" htmlFor={id("grade")} hint="Opcional, de 0 a 10">
          <input
            id={id("grade")}
            name="grade"
            inputMode="decimal"
            defaultValue={exam?.grade ?? ""}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>
    </>
  );
}
