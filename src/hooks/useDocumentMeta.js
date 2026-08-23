import { useEffect } from "react";

const DEFAULT_TITLE = "Clinical SOS — Rapid Response Consulting for Skilled Nursing & Long-Term Care";
const DEFAULT_DESCRIPTION =
  "Rapid-response consulting for skilled nursing and long-term care organizations facing survey deficiencies, compliance issues, operational instability, and leadership gaps.";

/**
 * Sets document.title and the meta[name=description] tag while the
 * calling component is mounted. Restores defaults on unmount.
 */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const prevDesc = meta.getAttribute("content");
    if (description) meta.setAttribute("content", description);

    return () => {
      document.title = DEFAULT_TITLE;
      const m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute("content", prevDesc || DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}