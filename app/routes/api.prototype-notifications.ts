// PROTOTYPE (wayfinder #14). Seeds the v1 catalogue Notifications into Knock
// for the *current* DevUI user, so every variant has realistic rows to show.
// In the real catalogue each Notification goes to a different role; here they
// all go to one person purely so the UI can be judged.
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.prototype-notifications";
import { db } from "~/db";
import { users, courses, lessons } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { knock, PROTOTYPE_WORKFLOW_KEY } from "~/lib/knock-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Select a user from the DevUI panel", { status: 401 });
  }
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  const course = db.select().from(courses).limit(1).get();
  const lesson = db.select().from(lessons).limit(1).get();
  const courseTitle = course?.title ?? "Intro to TypeScript";
  const courseUrl = course ? `/courses/${course.slug}` : "/courses";
  const lessonTitle = lesson?.title ?? "Generics";
  const lessonUrl =
    course && lesson
      ? `/courses/${course.slug}/lessons/${lesson.id}`
      : "/courses";

  const catalogue = [
    {
      kind: "refund-requested",
      actor: "Alex Rivera",
      title: "Refund Request",
      body: `Alex Rivera requested a refund for ${courseTitle}.`,
      url: "/admin/refunds",
      cta: "Review request",
    },
    {
      kind: "refund-approved",
      actor: "Priya Shah",
      title: "Refund approved",
      body: `Your refund for ${courseTitle} was approved. Your Enrollment has ended.`,
      note: "Sorry it wasn't a fit. Hope to see you again.",
      url: courseUrl,
      cta: "View course",
    },
    {
      kind: "refund-declined",
      actor: "Priya Shah",
      title: "Refund declined",
      body: `Your refund for ${courseTitle} was declined. You can raise a new Refund Request.`,
      note: "You've completed 80% of the course, which is past our refund window.",
      url: courseUrl,
      cta: "View course",
    },
    {
      kind: "seat-claimed",
      actor: "Sam Okafor",
      title: "Seat claimed",
      body: `Sam Okafor claimed a Seat on ${courseTitle} (3 of 10 left).`,
      url: "/team",
      cta: "View team",
    },
    {
      kind: "question-asked",
      actor: "Alex Rivera",
      title: "New Question",
      body: `Alex Rivera asked a Question on ${lessonTitle}: "Why does the inferred type widen here?"`,
      url: lessonUrl,
      cta: "Answer",
    },
    {
      kind: "reply-posted",
      actor: "Jo Lin (Instructor)",
      title: "New Reply",
      body: `Jo Lin (Instructor) replied to your Question on ${lessonTitle}.`,
      url: lessonUrl,
      cta: "Read reply",
    },
    {
      // Edge from the catalogue ticket: the comment behind this Notification was deleted.
      kind: "reply-posted",
      actor: "Jo Lin (Instructor)",
      title: "New Reply",
      body: `Jo Lin (Instructor) replied to your Question on ${lessonTitle}.`,
      url: null,
      deleted: true,
      cta: "Read reply",
    },
  ];

  for (const item of catalogue) {
    await knock().workflows.trigger(PROTOTYPE_WORKFLOW_KEY, {
      recipients: [{ id: String(user.id), name: user.name }],
      data: item,
    });
  }
  return { seeded: catalogue.length };
}
