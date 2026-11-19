import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLessonViewer } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let viewer: ReturnType<typeof createLessonViewer>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  viewer = createLessonViewer(db);
});

// ─── Fixtures ───

function addModule(title: string, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title, position })
    .returning()
    .get();
}

function addLesson(moduleId: number, title: string, position: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get();
}

function addComment(
  lessonId: number,
  comment: {
    userId: number;
    body: string;
    parentId?: number;
    deletedAt?: string;
  }
) {
  return db
    .insert(schema.comments)
    .values({ lessonId, ...comment, body: markdown(comment.body) })
    .returning()
    .get();
}

/** A quiz with one question per entry; returns each question's correct option. */
function addQuiz(
  lessonId: number,
  questionCount: number,
  questionType = schema.QuestionType.MultipleChoice
) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${i + 1}`,
        questionType,
        position: i,
      })
      .returning()
      .get();
    const [right, wrong] = [true, false].map((isCorrect) =>
      db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: isCorrect ? "right" : "wrong",
          isCorrect,
        })
        .returning()
        .get()
    );
    return { questionId: question.id, right: right.id, wrong: wrong.id };
  });
  return { quiz, questions };
}

/** Answers the first `correctCount` questions right and the rest wrong. */
function answer(
  questions: ReturnType<typeof addQuiz>["questions"],
  correctCount: number
) {
  return Object.fromEntries(
    questions.map((q, i) => [
      q.questionId,
      i < correctCount ? q.right : q.wrong,
    ])
  );
}

/** The test user submits these answers to the quiz. */
function submit(quizId: number, selectedAnswers: Record<number, number>) {
  return viewer.computeResult({
    userId: base.user.id,
    quizId,
    selectedAnswers,
  });
}

function quizOnNewLesson(
  questionCount: number,
  questionType = schema.QuestionType.MultipleChoice
) {
  const lesson = addLesson(addModule("M", 1).id, "L", 1);
  return { lesson, ...addQuiz(lesson.id, questionCount, questionType) };
}

// ─── Course structure ───

describe("getCourseWithDetails", () => {
  it("nests each module's lessons under it, both in position order", () => {
    const second = addModule("Second", 2);
    const first = addModule("First", 1);
    addLesson(first.id, "B", 2);
    addLesson(first.id, "A", 1);
    addLesson(second.id, "C", 1);

    const course = viewer.getCourseWithDetails(base.course.id);

    expect(
      course?.modules.map((m) => [m.title, m.lessons.map((l) => l.title)])
    ).toEqual([
      ["First", ["A", "B"]],
      ["Second", ["C"]],
    ]);
    expect(course?.instructorName).toBe("Test Instructor");
  });

  it("is null for a course that does not exist", () => {
    expect(viewer.getCourseWithDetails(9999)).toBeNull();
  });
});

describe("flattenCourseLessons", () => {
  it("lists every lesson in reading order with its module", () => {
    const first = addModule("First", 1);
    const second = addModule("Second", 2);
    addLesson(first.id, "A", 1);
    addLesson(second.id, "B", 1);

    const course = viewer.getCourseWithDetails(base.course.id);
    if (!course) throw new Error("course not found");

    expect(
      viewer.flattenCourseLessons(course).map((l) => [l.title, l.moduleTitle])
    ).toEqual([
      ["A", "First"],
      ["B", "Second"],
    ]);
  });
});

// ─── Progress ───

describe("lesson progress", () => {
  it("never moves a completed lesson back to in progress", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);

    viewer.markLessonComplete(base.user.id, lesson.id);
    viewer.markLessonInProgress(base.user.id, lesson.id);

    expect(viewer.getLessonProgress(base.user.id, lesson.id)?.status).toBe(
      schema.LessonProgressStatus.Completed
    );
  });

  it("returns only this course's progress for the person", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    viewer.markLessonInProgress(base.user.id, lesson.id);
    viewer.markLessonInProgress(base.instructor.id, lesson.id);

    const records = viewer.getLessonProgressForCourse(
      base.user.id,
      base.course.id
    );

    expect(records.map((r) => [r.userId, r.lessonId, r.status])).toEqual([
      [base.user.id, lesson.id, schema.LessonProgressStatus.InProgress],
    ]);
  });
});

describe("video watch state", () => {
  function watch(lessonId: number, positionSeconds: number, at: string) {
    db.insert(schema.videoWatchEvents)
      .values({
        userId: base.user.id,
        lessonId,
        eventType: "progress",
        positionSeconds,
        createdAt: at,
      })
      .run();
  }

  it("resumes from the latest event and measures the furthest one", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    watch(lesson.id, 90, "2026-01-01T00:00:00Z");
    watch(lesson.id, 30, "2026-01-02T00:00:00Z");

    expect(viewer.getLastWatchPosition(base.user.id, lesson.id)).toBe(30);
    expect(
      viewer.calculateWatchProgress(
        { userId: base.user.id, lessonId: lesson.id },
        120
      )
    ).toBe(75);
  });

  it("caps progress at 100 and starts unwatched lessons at 0", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);

    expect(viewer.getLastWatchPosition(base.user.id, lesson.id)).toBe(0);

    watch(lesson.id, 500, "2026-01-01T00:00:00Z");
    expect(
      viewer.calculateWatchProgress(
        { userId: base.user.id, lessonId: lesson.id },
        120
      )
    ).toBe(100);
  });
});

// ─── Discussion ───

describe("getLessonThread", () => {
  it("nests replies, blanks deleted questions, and drops empty deleted ones", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    const kept = addComment(lesson.id, {
      userId: base.user.id,
      body: "Why?",
      deletedAt: "2026-01-01T00:00:00Z",
    });
    addComment(lesson.id, {
      userId: base.instructor.id,
      body: "Because.",
      parentId: kept.id,
    });
    addComment(lesson.id, {
      userId: base.user.id,
      body: "Gone",
      deletedAt: "2026-01-01T00:00:00Z",
    });

    const thread = viewer.getLessonThread(lesson.id);

    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ deleted: true, body: "" });
    expect(thread[0].replies.map((r) => r.body)).toEqual(["Because."]);
    expect(thread[0].replies[0].author.isInstructor).toBe(true);
  });
});

// ─── Quiz ───

describe("computeResult", () => {
  it("grades the answers and records the attempt", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    const { quiz, questions } = addQuiz(lesson.id, 3);
    const answers = Object.fromEntries(
      questions.map((q) => [q.questionId, q.right])
    );

    const result = submit(quiz.id, answers);

    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 3,
      totalQuestions: 3,
    });
    expect(viewer.getBestAttempt(base.user.id, quiz.id)?.id).toBe(
      result?.attemptId
    );
  });

  it("counts wrong and unanswered questions as incorrect", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    const { quiz, questions } = addQuiz(lesson.id, 3);

    const result = submit(quiz.id, {
      [questions[0].questionId]: questions[0].right,
      [questions[1].questionId]: questions[1].wrong,
    });

    expect(result).toMatchObject({
      totalCorrect: 1,
      passed: false,
      grade: "F",
    });
    expect(result?.questionResults.map((r) => r.correct)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("is null for a quiz that does not exist", () => {
    expect(submit(9999, {})).toBeNull();
  });
});

describe("getQuizWithQuestions", () => {
  it("returns the questions in position order with their options", () => {
    const lesson = addLesson(addModule("M", 1).id, "L", 1);
    const { quiz } = addQuiz(lesson.id, 2);

    const loaded = viewer.getQuizWithQuestions(quiz.id);

    expect(loaded?.questions.map((q) => q.questionText)).toEqual(["Q1", "Q2"]);
    expect(loaded?.questions[0].options).toHaveLength(2);
    expect(viewer.getQuizByLessonId(lesson.id)?.id).toBe(quiz.id);
  });
});

describe("quiz grading", () => {
  it.each([
    [10, "A", true],
    [9, "A", true],
    [8, "B", true],
    [7, "C", false],
    [6, "D", false],
    [5, "F", false],
  ])("%i of 10 right is grade %s, passed %s", (right, grade, passed) => {
    const { quiz, questions } = quizOnNewLesson(10);

    const result = submit(quiz.id, answer(questions, right));

    expect(result).toMatchObject({ score: right / 10, grade, passed });
  });

  it("scores a quiz with no questions as 0", () => {
    const { quiz } = quizOnNewLesson(0);

    expect(submit(quiz.id, {})).toMatchObject({
      score: 0,
      totalQuestions: 0,
    });
  });

  it("grades true/false questions by their correct option", () => {
    const { quiz, questions } = quizOnNewLesson(
      2,
      schema.QuestionType.TrueFalse
    );

    const result = submit(quiz.id, answer(questions, 1));

    expect(result?.questionResults).toEqual([
      {
        questionId: questions[0].questionId,
        correct: true,
        selectedOptionId: questions[0].right,
        correctOptionId: questions[0].right,
      },
      {
        questionId: questions[1].questionId,
        correct: false,
        selectedOptionId: questions[1].wrong,
        correctOptionId: questions[1].right,
      },
    ]);
  });

  it("marks a question with no correct option wrong", () => {
    const { quiz } = quizOnNewLesson(0);
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: "Trick",
        questionType: schema.QuestionType.MultipleChoice,
        position: 0,
      })
      .returning()
      .get();
    const option = db
      .insert(schema.quizOptions)
      .values({ questionId: question.id, optionText: "no", isCorrect: false })
      .returning()
      .get();

    const result = submit(quiz.id, {
      [question.id]: option.id,
    });

    expect(result?.questionResults[0]).toMatchObject({
      correct: false,
      correctOptionId: null,
    });
  });

  it("records an answer only for the questions that were answered", () => {
    const { quiz, questions } = quizOnNewLesson(2);

    const result = submit(quiz.id, {
      [questions[0].questionId]: questions[0].right,
    });

    const recorded = db.select().from(schema.quizAnswers).all();
    expect(recorded.map((a) => [a.attemptId, a.selectedOptionId])).toEqual([
      [result?.attemptId, questions[0].right],
    ]);
  });
});

describe("lookups by id", () => {
  it("finds the lesson, module, user, comment and quiz", () => {
    const mod = addModule("M", 1);
    const lesson = addLesson(mod.id, "L", 1);
    const comment = addComment(lesson.id, { userId: base.user.id, body: "Hi" });
    const { quiz } = addQuiz(lesson.id, 0);

    expect(viewer.getLessonById(lesson.id)?.title).toBe("L");
    expect(viewer.getModuleById(mod.id)?.title).toBe("M");
    expect(viewer.getUserById(base.user.id)?.name).toBe("Test User");
    expect(viewer.getCommentById(comment.id)?.body).toBe("Hi");
    expect(viewer.getQuizById(quiz.id)?.id).toBe(quiz.id);
  });

  it("finds nothing for a quiz that does not exist", () => {
    expect(viewer.getQuizWithQuestions(9999)).toBeNull();
  });
});
