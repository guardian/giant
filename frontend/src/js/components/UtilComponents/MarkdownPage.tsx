import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkHeadingId from "remark-heading-id";
import rehypeRaw from "rehype-raw";

type MarkdownPageProps = {
  src: string;
  fullHeight?: boolean;
};

export function getIdFromHash(hash: string): string | null {
  if (!hash) return null;
  return decodeURIComponent(hash.slice(1));
}

export function markdownScrollTop(offsetTop: number): number {
  return offsetTop - 60;
}

export default function MarkdownPage({ src, fullHeight }: MarkdownPageProps) {
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      })
      .then(setMarkdown)
      .catch(() => setMarkdown("# Failed to load documentation"));
  }, [src]);

  useEffect(() => {
    if (!fullHeight) return;

    const content = document.querySelector<HTMLElement>(".app__content");
    if (content) {
      content.classList.add("app__content--docs");
      return () => content.classList.remove("app__content--docs");
    }
  }, [fullHeight]);

  useEffect(() => {
    if (!markdown) return;

    const scrollToHash = () => {
      const id = getIdFromHash(window.location.hash);
      if (!id) return;

      const el = document.getElementById(id);
      const content = document.querySelector<HTMLElement>(".app__content");

      if (el && content) {
        content.scrollTo({
          top: markdownScrollTop(el.offsetTop),
          behavior: "auto",
        });
      }
    };

    // Wait for markdown headings to be present in the DOM before scrolling.
    const raf = window.requestAnimationFrame(scrollToHash);
    window.addEventListener("hashchange", scrollToHash);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [markdown]);

  return (
    <div className="app__main-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHeadingId]}
        rehypePlugins={[rehypeRaw]}
        className="markdown-page"
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
