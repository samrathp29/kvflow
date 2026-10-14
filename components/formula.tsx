"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export function Formula({
  tex,
  display = false,
}: {
  tex: string;
  display?: boolean;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: true,
        output: "htmlAndMathml",
      }),
    [display, tex],
  );

  return (
    <span
      className={
        display
          ? "formula-display block overflow-x-auto py-1"
          : "formula-inline"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
