"use client";

type Note = { title: string; body: string };

const defaultNotes: Note[] = [
  {
    title: "How this works",
    body:
      "Ask a question. The agent may search with Tavily, then streams a synthesized answer with sources.",
  },
  {
    title: "Tip",
    body:
      "Add context like city or date for fresher results. Example: “Boston weather now”.",
  },
];

export default function SubNotes({ notes = defaultNotes }: { notes?: Note[] }) {
  return (
    <section className="mx-auto mt-4 w-full max-w-5xl px-4">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500">
          Notes by Trishul
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-zinc-800">{n.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
