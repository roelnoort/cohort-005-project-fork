import type { RenderedComment } from "~/components/comment-thread";
import type { lessons } from "~/db/schema";
import type { DenialReason } from "~/modules/permissions/course-permissions.server";

// The data the lesson page components render. The lesson route's loader
// returns exactly these shapes; the components declare them here rather than
// importing the route's generated `+types`, so they do not depend on a route.

type CourseSummary = { id: number; title: string; slug: string };

export type CurriculumModule = {
  id: number;
  title: string;
  lessons: Array<{ id: number; title: string }>;
};

type NeighbourLesson = {
  id: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
};

export type LessonQuiz = {
  id: number;
  title: string;
  passingScore: number;
  questions: Array<{
    id: number;
    questionText: string;
    questionType: string;
    position: number;
    options: Array<{ id: number; optionText: string }>;
  }>;
};

export type LockedLessonData = {
  view: "locked";
  course: CourseSummary;
  curriculum: CurriculumModule[];
  module: { id: number; title: string };
  lesson: { id: number; title: string };
  enrolled: boolean;
  lockedReason: DenialReason;
};

export type FullLessonData = {
  view: "full";
  course: CourseSummary;
  curriculum: CurriculumModule[];
  module: { id: number; title: string };
  lesson: typeof lessons.$inferSelect;
  contentHtml: string | null;
  lessonStatus: string | null;
  enrolled: boolean;
  currentUserId: number | null;
  prevLesson: NeighbourLesson | null;
  nextLesson: NeighbourLesson | null;
  quiz: LessonQuiz | null;
  bestAttempt: { score: number; passed: boolean } | null;
  lastWatchPosition: number;
  watchProgress: number;
  lessonProgressMap: Record<number, string>;
  comments: RenderedComment[];
  canModerate: boolean;
  instructorName: string;
  bookmarked: boolean;
  note: { body: string; updatedAt: string } | null;
};
