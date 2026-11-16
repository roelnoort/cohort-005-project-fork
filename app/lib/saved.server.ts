import { and, desc, eq } from "drizzle-orm";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";
import type { Db } from "~/lib/comments.server";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

// ─── Bookmarks and Notes ───
// What a Student attaches to a Lesson for themselves. See GLOSSARY.md.
//
// A Note is private to the Student who wrote it: every read here is scoped to
// one Student. Do not add a query that reads another person's Note bodies.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Content access is checked by the caller (the Lesson action).

// The Lesson and Course a Saved row links back to.
const lessonRefColumns = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};

export function isBookmarked(db: Db, userId: number, lessonId: number) {
  return !!db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .get();
}

/** Adds the Bookmark if there is none, removes it if there is one. Returns
 * whether the Lesson is bookmarked afterwards. */
export function toggleBookmark(
  db: Db,
  userId: number,
  lessonId: number,
  now: Date
): boolean {
  const removed = db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .returning({ id: bookmarks.id })
    .all();
  if (removed.length > 0) return false;

  // The unique index makes a racing second insert a no-op, not a duplicate.
  db.insert(bookmarks)
    .values({ userId, lessonId, createdAt: now.toISOString() })
    .onConflictDoNothing()
    .run();
  return true;
}

export function listBookmarks(db: Db, userId: number) {
  return db
    .select({
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
      ...lessonRefColumns,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();
}

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

export type Note = typeof notes.$inferSelect;

export type SaveNoteResult =
  { ok: true; note: Note | null } | { ok: false; error: string };

/**
 * Stores the Student's Note on a Lesson, replacing the body of an existing one
 * and moving its "last edited" time on. The body is trimmed; an empty body
 * clears the Note. A body over the cap is refused, never truncated.
 */
export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const trimmed = body.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `A note must be ${MAX_NOTE_LENGTH.toLocaleString("en")} characters or fewer.`,
    };
  }

  if (trimmed.length === 0) {
    db.delete(notes)
      .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
      .run();
    return { ok: true, note: null };
  }

  const timestamp = now.toISOString();
  // Upsert on the unique (user, lesson) index: a re-save keeps createdAt.
  const note = db
    .insert(notes)
    .values({
      userId,
      lessonId,
      body: trimmed,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: trimmed, updatedAt: timestamp },
    })
    .returning()
    .get();
  return { ok: true, note };
}

export function listNotes(db: Db, userId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      ...lessonRefColumns,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}
