// PROTOTYPE (wayfinder #14: What does the Notification Feed look like in Cadence?)
// Three structurally different Notification Feed variants, switchable via
// ?variant=A|B|C and the floating bar. Reads the real Knock feed for the
// current DevUI user with a server-signed user token.
// Throwaway: lives on branch prototype/notification-feed only.
import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import Knock, {
  type Feed,
  type FeedItem,
  type FeedStoreState,
} from "@knocklabs/client";
import {
  Bell,
  BellDot,
  Check,
  CheckCheck,
  ChevronRight,
  Archive,
  PanelRightClose,
  PanelRightOpen,
  Receipt,
  MessageSquare,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  PrototypeSwitcher,
  usePrototypeVariant,
  type VariantDef,
} from "~/components/prototype-switcher";

export interface KnockFeedProps {
  publicKey: string;
  feedChannelId: string;
  userId: string;
  userToken: string;
}

interface NotificationData {
  kind: string;
  actor: string;
  title: string;
  body: string;
  note?: string;
  url: string | null;
  cta: string;
  deleted?: boolean;
}

type Item = FeedItem<NotificationData>;

export const VARIANTS: VariantDef[] = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Sidebar inbox drawer" },
  { key: "C", name: "Action rail" },
];

// ---------------------------------------------------------------------------
// Knock wiring (shared plumbing, not layout)

function useKnockFeed(props: KnockFeedProps | null) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [state, setState] = useState<FeedStoreState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props) return;
    const knock = new Knock(props.publicKey);
    knock.authenticate(props.userId, props.userToken);
    const f = knock.feeds.initialize(props.feedChannelId, {
      archived: "exclude",
      page_size: 30,
    });
    const unsub = f.store.subscribe(setState);
    f.listenForUpdates();
    f.fetch().catch((e) => setError(String(e)));
    setFeed(f);
    setState(f.getState());
    return () => {
      unsub();
      f.dispose();
      knock.teardown();
    };
  }, [props?.userId, props?.userToken]);

  const items = (state?.items ?? []) as Item[];
  const meta = state?.metadata ?? {
    total_count: 0,
    unread_count: 0,
    unseen_count: 0,
  };
  return { feed, items, meta, loading: state?.loading ?? !error, error };
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function kindIcon(kind: string, className = "size-4") {
  if (kind.startsWith("refund")) return <Receipt className={className} />;
  if (kind === "seat-claimed") return <UsersRound className={className} />;
  return <MessageSquare className={className} />;
}

function initials(name: string) {
  return name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

// ---------------------------------------------------------------------------
// Entry point: returns slots the layout drops into the sidebar / page.

export function useNotificationFeedPrototype(props: KnockFeedProps | null) {
  const variant = usePrototypeVariant(VARIANTS);
  const k = useKnockFeed(props);
  const seed = useFetcher();

  const switcher = (
    <PrototypeSwitcher variants={VARIANTS} current={variant}>
      {props ? (
        <>
          <span>
            unseen {k.meta.unseen_count} · unread {k.meta.unread_count} · total{" "}
            {k.meta.total_count}
          </span>
          <seed.Form method="post" action="/api/prototype-notifications">
            <button className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30">
              {seed.state === "idle" ? "Seed catalogue" : "Seeding…"}
            </button>
          </seed.Form>
          {k.error && <span className="text-red-200">{k.error}</span>}
        </>
      ) : (
        <span>no DevUI user / Knock keys</span>
      )}
    </PrototypeSwitcher>
  );

  if (!props || !k.feed) {
    return { sidebarHeader: null, sidebarNav: null, rightRail: null, switcher };
  }

  const ctx = { feed: k.feed, items: k.items, meta: k.meta };
  return {
    sidebarHeader: variant.key === "A" ? <VariantA {...ctx} /> : null,
    sidebarNav: variant.key === "B" ? <VariantB {...ctx} /> : null,
    rightRail: variant.key === "C" ? <VariantC {...ctx} /> : null,
    switcher,
  };
}

interface Ctx {
  feed: Feed;
  items: Item[];
  meta: { unread_count: number; unseen_count: number; total_count: number };
}

// ---------------------------------------------------------------------------
// Variant A: bell in the sidebar header, compact popover.
// Badge = UNSEEN. Opening marks everything seen. Clicking a row marks it read
// and navigates. One-line rows, unread dot.

function VariantA({ feed, items, meta }: Ctx) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    if (meta.unseen_count > 0) feed.markAllAsSeen();
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-5" />
        {meta.unseen_count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {meta.unseen_count > 9 ? "9+" : meta.unseen_count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={() => feed.markAllAsRead()}
              className="text-xs text-muted-foreground hover:underline"
            >
              Mark all as read
            </button>
          </div>
          <ul className="max-h-[28rem] divide-y overflow-y-auto">
            {items.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                You're all caught up.
              </li>
            )}
            {items.map((item) => {
              const d = item.data!;
              const unread = !item.read_at;
              return (
                <li key={item.id}>
                  <button
                    disabled={!d.url}
                    onClick={() => {
                      feed.markAsRead(item);
                      setOpen(false);
                      if (d.url) navigate(d.url);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent",
                      unread && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        unread ? "bg-primary" : "bg-transparent"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "line-clamp-2",
                          d.deleted && "text-muted-foreground line-through"
                        )}
                      >
                        {d.body}
                      </span>
                      {d.deleted && (
                        <span className="block text-xs italic text-muted-foreground">
                          This Reply was deleted.
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {timeAgo(item.inserted_at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B: "Notifications" nav item with UNREAD count, opens a full-height
// slide-over drawer. Unread / All tabs, Today / Earlier groups, rich rows
// (avatar, title, body, decision note), hover actions: mark read/unread, archive.
// No "seen" concept: the count only drops when you read.

function VariantB({ feed, items, meta }: Ctx) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const navigate = useNavigate();

  const shown = tab === "unread" ? items.filter((i) => !i.read_at) : items;
  const today = new Date().toDateString();
  const groups = [
    {
      label: "Today",
      items: shown.filter((i) => new Date(i.inserted_at).toDateString() === today),
    },
    {
      label: "Earlier",
      items: shown.filter((i) => new Date(i.inserted_at).toDateString() !== today),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {meta.unread_count > 0 ? (
          <BellDot className="size-4" />
        ) : (
          <Bell className="size-4" />
        )}
        Notifications
        {meta.unread_count > 0 && (
          <span className="ml-auto rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
            {meta.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[28rem] flex-col bg-background shadow-2xl"
          >
            <header className="flex items-center gap-2 border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button
                onClick={() => feed.markAllAsRead()}
                className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-accent">
                <X className="size-4" />
              </button>
            </header>
            <div className="flex gap-1 border-b px-5">
              {(["unread", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm capitalize",
                    tab === t
                      ? "border-primary font-medium"
                      : "border-transparent text-muted-foreground"
                  )}
                >
                  {t}
                  {t === "unread" && ` (${meta.unread_count})`}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.length === 0 && (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  Nothing {tab === "unread" ? "unread" : "here"}.
                </p>
              )}
              {groups.map((g) => (
                <section key={g.label}>
                  <h3 className="bg-muted/50 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </h3>
                  {g.items.map((item) => {
                    const d = item.data!;
                    const unread = !item.read_at;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!d.url) return;
                          feed.markAsRead(item);
                          setOpen(false);
                          navigate(d.url);
                        }}
                        className={cn(
                          "group relative flex gap-3 border-b px-5 py-4",
                          d.url && "cursor-pointer hover:bg-accent/50"
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {initials(d.actor)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={cn(unread ? "font-semibold" : "text-muted-foreground")}>
                              {d.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {timeAgo(item.inserted_at)}
                            </span>
                            {unread && <span className="size-2 rounded-full bg-primary" />}
                          </div>
                          <p className="mt-0.5 text-sm">{d.body}</p>
                          {d.note && (
                            <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-muted-foreground">
                              {d.note}
                            </blockquote>
                          )}
                          {d.deleted && (
                            <p className="mt-1 text-xs italic text-muted-foreground">
                              The Reply has since been deleted.
                            </p>
                          )}
                        </div>
                        <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
                          <button
                            title={unread ? "Mark read" : "Mark unread"}
                            onClick={(e) => {
                              e.stopPropagation();
                              unread ? feed.markAsRead(item) : feed.markAsUnread(item);
                            }}
                            className="rounded-md border bg-background p-1 hover:bg-accent"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            title="Archive"
                            onClick={(e) => {
                              e.stopPropagation();
                              feed.markAsArchived(item);
                            }}
                            className="rounded-md border bg-background p-1 hover:bg-accent"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant C: a persistent right rail beside every page. Notifications are
// to-dos: each card has an explicit CTA button. Reading happens only via the
// CTA; "Dismiss" archives. Header shows how many still need action.

function VariantC({ feed, items, meta }: Ctx) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const pending = items.filter((i) => !i.read_at);
  const done = items.filter((i) => i.read_at);

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-3 border-l bg-sidebar py-4">
        <button onClick={() => setCollapsed(false)} className="rounded-md p-1 hover:bg-sidebar-accent" title="Open">
          <PanelRightOpen className="size-4" />
        </button>
        <span className="relative">
          <Bell className="size-5 text-sidebar-foreground/70" />
          {meta.unread_count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {meta.unread_count}
            </span>
          )}
        </span>
      </aside>
    );
  }

  function card(item: Item, faded: boolean) {
    const d = item.data!;
    return (
      <div
        key={item.id}
        className={cn(
          "rounded-lg border bg-card p-3 text-sm shadow-sm",
          faded && "opacity-60"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          {kindIcon(d.kind, "size-3.5")}
          <span className="font-medium uppercase tracking-wide">{d.title}</span>
          <span className="ml-auto">{timeAgo(item.inserted_at)}</span>
        </div>
        <p>{d.body}</p>
        {d.note && (
          <p className="mt-1 text-xs italic text-muted-foreground">"{d.note}"</p>
        )}
        {!faded && (
          <div className="mt-3 flex gap-2">
            {d.url ? (
              <button
                onClick={() => {
                  feed.markAsRead(item);
                  navigate(d.url!);
                }}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {d.cta} <ChevronRight className="size-3" />
              </button>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                The Reply was deleted.
              </span>
            )}
            <button
              onClick={() => feed.markAsArchived(item)}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-sidebar">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <span className="font-semibold">Needs your attention</span>
        {meta.unread_count > 0 && (
          <span className="rounded-full bg-red-600 px-2 text-xs font-semibold text-white">
            {meta.unread_count}
          </span>
        )}
        <button onClick={() => setCollapsed(true)} className="ml-auto rounded-md p-1 hover:bg-sidebar-accent" title="Collapse">
          <PanelRightClose className="size-4" />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {pending.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing needs you right now.
          </p>
        )}
        {pending.map((i) => card(i, false))}
        {done.length > 0 && (
          <>
            <h3 className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Done
            </h3>
            {done.map((i) => card(i, true))}
          </>
        )}
      </div>
    </aside>
  );
}
