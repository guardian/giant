import React from "react";
import PropTypes from "prop-types";
import _escape from "lodash/fp/escape";

type HighlightedTextProps = {
  value: string;
  preferences?: { showSearchHighlights?: boolean } | null;
};

function escapeHighlights(text: string): { __html: string } {
  const escaped = _escape(text)
    .replace(
      new RegExp(_escape("<result-highlight>"), "g"),
      "<result-highlight>",
    )
    .replace(
      new RegExp(_escape("</result-highlight>"), "g"),
      "</result-highlight>",
    );

  return { __html: escaped };
}

function removeHighlights(text: string): { __html: string } {
  const escaped = _escape(text)
    .replace(new RegExp(_escape("<result-highlight>"), "g"), "")
    .replace(new RegExp(_escape("</result-highlight>"), "g"), "");

  return { __html: escaped };
}

export function HighlightedText({ value, preferences }: HighlightedTextProps) {
  const innerHtml =
    preferences && !preferences.showSearchHighlights
      ? removeHighlights(value)
      : escapeHighlights(value);

  return <span dangerouslySetInnerHTML={innerHtml} />;
}

HighlightedText.propTypes = {
  value: PropTypes.string.isRequired,
  preferences: PropTypes.object,
};
