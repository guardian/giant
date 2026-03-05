import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkHeadingId from "remark-heading-id";
import rehypeRaw from "rehype-raw";

export default function MarkdownPage({ src, fullHeight }) {
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    fetch(src)
      .then((res) => res.text())
      .then(setMarkdown);
  }, [src]);

  useEffect(() => {
    if (!fullHeight) return;
    const content = document.querySelector(".app__content");
    if (content) {
      content.classList.add("app__content--docs");
      return () => content.classList.remove("app__content--docs");
    }
  }, [fullHeight]);

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
