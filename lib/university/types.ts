export type Subject = {
  id: string;
  name: string;
  description: string | null;
};

export type SubjectSummary = Subject & {
  topicCount: number;
  nextExam: ExamSummary | null;
};

export type PageSummary = { id: string; title: string; updatedAt: string };

export type Topic = {
  id: string;
  title: string;
  pages: PageSummary[];
};

export type Exam = {
  id: string;
  subjectId: string;
  title: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` or null */
  time: string | null;
  location: string | null;
  grade: number | null;
};

export type ExamSummary = Exam & { subjectName: string };

/** Minimal shape of a Tiptap/ProseMirror document. */
export type DocJSON = { type: "doc"; content?: unknown[] };

export type NotePage = {
  id: string;
  title: string;
  content: DocJSON;
  version: number;
  updatedAt: string;
  topic: { id: string; title: string };
  subject: { id: string; name: string };
};

export const EMPTY_DOC: DocJSON = { type: "doc", content: [] };
