"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AnimatePresence, motion } from "motion/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { renamePage, savePageContent } from "@/app/(app)/universidad/actions";
import { Autosaver, SAVE_LABEL, hasUnsavedWork, type SaveStatus } from "@/lib/university/autosave";
import type { DocJSON } from "@/lib/university/types";
import { TITLE_MAX } from "@/lib/university/validation";

export function NoteEditor({
  pageId,
  initialTitle,
  initialContent,
  initialVersion,
}: {
  pageId: string;
  initialTitle: string;
  initialContent: DocJSON;
  initialVersion: number;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [saver] = useState(
    () =>
      new Autosaver<DocJSON>({
        initialVersion,
        save: async (doc, expected) => {
          const r = await savePageContent(pageId, doc, expected);
          return r.ok ? { ok: true, version: r.version } : r;
        },
        onStatus: (next, msg) => {
          setStatus(next);
          setMessage(msg);
        },
      }),
  );

  const editor = useEditor({
    immediatelyRender: false,
    // Re-render on every transaction so the toolbar reflects the selection.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "Empieza a escribir tus apuntes…" }),
    ],
    content: initialContent as JSONContent,
    editorProps: {
      attributes: { class: "note-content", "aria-label": "Apuntes", "aria-multiline": "true" },
    },
    onUpdate: ({ editor }) => saver.change(editor.getJSON() as DocJSON),
  });

  // Warn before closing the tab with unsaved notes.
  useEffect(() => {
    if (!hasUnsavedWork(status)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  // Save whatever is pending when leaving the page in-app.
  useEffect(() => {
    return () => {
      if (saver.hasPending()) saver.flushNow();
      saver.dispose();
    };
  }, [saver]);

  return (
    <div className="flex flex-col gap-6">
      <TitleInput pageId={pageId} initialTitle={initialTitle} />

      <div className="sticky top-0 z-10 -mx-2 flex items-center justify-between gap-2 bg-surface/90 px-2 py-2 backdrop-blur-sm">
        <Toolbar editor={editor} />
        <SaveIndicator status={status} />
      </div>

      {message && (
        <p role="alert" className="animate-enter rounded-atlas bg-line/20 px-4 py-3 text-sm text-ink">
          {message}
        </p>
      )}

      <EditorContent editor={editor} className="min-h-[50dvh]" />
    </div>
  );
}

function TitleInput({ pageId, initialTitle }: { pageId: string; initialTitle: string }) {
  const [saved, setSaved] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);

  async function commit(value: string) {
    const title = value.trim();
    if (!title || title === saved) return;
    const result = await renamePage(pageId, title);
    if (result.ok) {
      setSaved(title);
      setError(null);
    } else {
      setError(result.error ?? "No se ha podido renombrar.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="page-title" className="sr-only">
        Título de la página
      </label>
      <input
        id="page-title"
        defaultValue={initialTitle}
        maxLength={TITLE_MAX}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-full rounded-atlas bg-transparent text-title font-bold text-ink focus-visible:outline-offset-4 md:text-display"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const tone =
    status === "conflict" || status === "invalid"
      ? "text-red-700"
      : status === "retrying"
        ? "text-accent"
        : "text-muted";
  return (
    <div aria-live="polite" className="relative h-5 shrink-0 text-right text-xs">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className={`block whitespace-nowrap ${tone}`}
        >
          {SAVE_LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

type ToolbarItem = {
  label: string;
  icon: LucideIcon;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const MARKS: ToolbarItem[] = [
  { label: "Negrita", icon: Bold, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { label: "Cursiva", icon: Italic, isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: "Subrayado", icon: Underline, isActive: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
];

const BLOCKS: ToolbarItem[] = [
  { label: "Título", icon: Heading2, isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Subtítulo", icon: Heading3, isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Lista", icon: List, isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Lista numerada", icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Cita", icon: Quote, isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Código", icon: Code, isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div aria-hidden className="h-10 w-80 animate-skeleton rounded-atlas bg-line/20" />;
  }

  const state = {
    active: [...MARKS, ...BLOCKS].map((item) => item.isActive(editor)),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };

  const button = (item: ToolbarItem, active: boolean) => (
    <button
      key={item.label}
      type="button"
      onClick={() => item.run(editor)}
      aria-label={item.label}
      aria-pressed={active}
      title={item.label}
      className={`pressable flex size-10 items-center justify-center rounded-atlas ${
        active ? "bg-raised text-white" : "text-body hover:bg-line/30"
      }`}
    >
      <item.icon aria-hidden className="size-5" />
    </button>
  );

  return (
    <div role="toolbar" aria-label="Formato" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {MARKS.map((item, i) => button(item, state.active[i]))}
      <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line" />
      {BLOCKS.map((item, i) => button(item, state.active[MARKS.length + i]))}
      <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!state.canUndo}
        aria-label="Deshacer"
        title="Deshacer"
        className="pressable flex size-10 items-center justify-center rounded-atlas text-body hover:bg-line/30"
      >
        <Undo2 aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!state.canRedo}
        aria-label="Rehacer"
        title="Rehacer"
        className="pressable flex size-10 items-center justify-center rounded-atlas text-body hover:bg-line/30"
      >
        <Redo2 aria-hidden className="size-5" />
      </button>
    </div>
  );
}
