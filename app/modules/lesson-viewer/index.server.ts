import { db } from "~/db";
import type { Db } from "./lib/db";
import * as course from "./lib/course";
import * as progress from "./lib/progress";
import * as comments from "./lib/comments";
import * as quiz from "./lib/quiz";

export type { FlatLesson } from "./lib/course";
export type { ThreadComment } from "./lib/comments";
export type { Viewing } from "./lib/progress";
export type { QuestionResult, Submission } from "./lib/quiz";

/**
 * The reads and writes behind the lesson page, bound to a database. The app
 * uses `lessonViewer`, which reads the app database; tests build their own
 * against a test database.
 */
export function createLessonViewer(database: Db) {
  return {
    // Course, module, lesson and the people on them
    getCourseWithDetails: (id: number) =>
      course.getCourseWithDetails(database, id),
    getLessonById: (id: number) => course.getLessonById(database, id),
    getModuleById: (id: number) => course.getModuleById(database, id),
    getUserById: (id: number) => course.getUserById(database, id),
    /** Every lesson of a course in reading order, for prev/next navigation. */
    flattenCourseLessons: course.flattenCourseLessons,

    // Lesson progress and video watch state
    getLessonProgress: (userId: number, lessonId: number) =>
      progress.getLessonProgress(database, userId, lessonId),
    getLessonProgressForCourse: (userId: number, courseId: number) =>
      progress.getLessonProgressForCourse(database, userId, courseId),
    markLessonComplete: (userId: number, lessonId: number) =>
      progress.markLessonComplete(database, userId, lessonId),
    /** Never moves a completed lesson back to in progress. */
    markLessonInProgress: (userId: number, lessonId: number) =>
      progress.markLessonInProgress(database, userId, lessonId),
    getLastWatchPosition: (userId: number, lessonId: number) =>
      progress.getLastWatchPosition(database, userId, lessonId),
    /** The furthest position watched, as a percentage capped at 100. */
    calculateWatchProgress: (
      viewing: progress.Viewing,
      videoDurationSeconds: number
    ) =>
      progress.calculateWatchProgress(database, viewing, videoDurationSeconds),

    // The lesson's discussion
    getCommentById: (commentId: number) =>
      comments.getCommentById(database, commentId),
    getLessonThread: (lessonId: number) =>
      comments.getLessonThread(database, lessonId),
    /** Renders comment bodies to sanitised HTML, keeping the nesting. */
    renderThread: comments.renderThread,

    // The lesson's quiz
    getQuizById: (quizId: number) => quiz.getQuizById(database, quizId),
    getQuizByLessonId: (lessonId: number) =>
      quiz.getQuizByLessonId(database, lessonId),
    getQuizWithQuestions: (quizId: number) =>
      quiz.getQuizWithQuestions(database, quizId),
    getBestAttempt: (userId: number, quizId: number) =>
      quiz.getBestAttempt(database, userId, quizId),
    /** Grades the answers and records the attempt. Null if the quiz is gone. */
    computeResult: (submission: quiz.Submission) =>
      quiz.computeResult(database, submission),
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonViewer = /* @__PURE__ */ createLessonViewer(db);
