// PROTOTYPE switcher bar. Throwaway, lives on prototype/* branches only.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantDef {
  key: string;
  name: string;
}

const STORAGE_KEY = "prototype-variant";

/** ?variant= wins; otherwise remember the last one so navigating away keeps it. */
export function usePrototypeVariant(variants: VariantDef[]) {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get("variant");
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
    setStored(sessionStorage.getItem(STORAGE_KEY));
  }, [fromUrl]);

  const key = fromUrl ?? stored ?? variants[0].key;
  return variants.find((v) => v.key === key) ?? variants[0];
}

export function PrototypeSwitcher({
  variants,
  current,
  children,
}: {
  variants: VariantDef[];
  current: VariantDef;
  children?: React.ReactNode;
}) {
  const [, setSearchParams] = useSearchParams();

  function go(delta: number) {
    const i = variants.findIndex((v) => v.key === current.key);
    const next = variants[(i + delta + variants.length) % variants.length];
    sessionStorage.setItem(STORAGE_KEY, next.key);
    setSearchParams(
      (prev) => {
        prev.set("variant", next.key);
        return prev;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-fuchsia-700 px-3 py-2 text-sm text-white shadow-2xl ring-2 ring-fuchsia-300">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-mono font-semibold">
        {current.key} ({current.name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
      {children && (
        <span className="flex items-center gap-2 border-l border-white/30 pl-3 font-mono text-xs">
          {children}
        </span>
      )}
    </div>
  );
}
