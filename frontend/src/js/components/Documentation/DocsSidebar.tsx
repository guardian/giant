import React, { useCallback, useEffect, useRef, useState } from "react";

type Heading = {
  level: number;
  text: string;
  id: string;
};

export function findActiveHeadingId(
  headings: Heading[],
  scrollTop: number,
  getElementById: (id: string) => HTMLElement | null = (id) =>
    document.getElementById(id),
): string | null {
  // get the first heading within 80px of the scroll position
  const [activeHeading] = headings.filter((h) => {
    const headingScrollTop = getElementById(h.id)?.scrollTop;
    return headingScrollTop && headingScrollTop - 80 <= scrollTop;
  });

  return activeHeading?.id ?? null;
}

function collectHeadingsFromDom(): Heading[] {
  const els = document.querySelectorAll<HTMLElement>(
    ".markdown-page h1[id], .markdown-page h2[id]",
  );
  return Array.from(els).map((el) => ({
    level: el.tagName === "H1" ? 1 : 2,
    text: el.textContent ?? "",
    id: el.id,
  }));
}

export default function DocsSidebar() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rafId = useRef<number | null>(null);

  // Collect headings from the rendered DOM rather than re-fetching the markdown.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const found = collectHeadingsFromDom();
      if (found.length > 0) {
        setHeadings(found);
        observer.disconnect();
      }
    });

    const target = document.querySelector(".app__content");
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
      // Also try immediately in case content is already rendered.
      const found = collectHeadingsFromDom();
      if (found.length > 0) {
        setHeadings(found);
        observer.disconnect();
      }
    }

    return () => observer.disconnect();
  }, []);

  const updateActiveId = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;
      const content = document.querySelector<HTMLElement>(".app__content");
      if (!content || headings.length === 0) return;
      setActiveId(findActiveHeadingId(headings, content.scrollTop));
    });
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) return;
    const content = document.querySelector<HTMLElement>(".app__content");
    if (!content) return;

    content.addEventListener("scroll", updateActiveId, { passive: true });
    updateActiveId();
    return () => {
      content.removeEventListener("scroll", updateActiveId);
      if (rafId.current !== null) window.cancelAnimationFrame(rafId.current);
    };
  }, [headings, updateActiveId]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    const content = document.querySelector<HTMLElement>(".app__content");
    if (el && content) {
      content.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${id}`,
      );
      setActiveId(id);
    }
  };

  return (
    <div className="sidebar docs-sidebar">
      <nav className="docs-sidebar__toc">
        {headings.map((h) => (
          <button
            key={h.id}
            className={`docs-sidebar__link${h.level === 2 ? " docs-sidebar__link--sub" : ""}${activeId === h.id ? " docs-sidebar__link--active" : ""}`}
            onClick={() => scrollTo(h.id)}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
