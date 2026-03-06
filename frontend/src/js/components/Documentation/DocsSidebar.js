import React, { useState, useEffect, useCallback } from "react";

function parseHeadings(markdown) {
  const headings = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,2})\s+\**(.+?)\**\s*\{#(.+?)\}/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
        id: match[3],
      });
    }
  }
  return headings;
}

export default function DocsSidebar() {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    fetch("/docs/UsingGiant.md")
      .then((res) => res.text())
      .then((text) => setHeadings(parseHeadings(text)));
  }, []);

  const updateActiveId = useCallback(() => {
    const content = document.querySelector(".app__content");
    if (!content || headings.length === 0) return;
    const scrollTop = content.scrollTop;
    let current = null;
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el && el.offsetTop - 80 <= scrollTop) {
        current = h.id;
      }
    }
    setActiveId(current);
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) return;
    const content = document.querySelector(".app__content");
    if (!content) return;

    content.addEventListener("scroll", updateActiveId);
    updateActiveId();
    return () => content.removeEventListener("scroll", updateActiveId);
  }, [headings, updateActiveId]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    const content = document.querySelector(".app__content");
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
