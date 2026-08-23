import { useEffect } from "react";

const DEFAULT_TITLE = "Clinical SOS — Rapid Response Consulting for Skilled Nursing & Long-Term Care";
const DEFAULT_DESCRIPTION =
  "Rapid-response consulting for skilled nursing and long-term care organizations facing survey deficiencies, compliance issues, operational instability, and leadership gaps.";
const SITE_NAME = "Clinical SOS";

function upsertMeta(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets document.title, meta description, Open Graph tags, and Twitter
 * Card tags while the calling component is mounted. Restores defaults
 * on unmount. Canonical URLs are intentionally not set here — they
 * will be added once the production custom domain is connected.
 */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    const fullTitle = title || DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;

    upsertMeta("name", "description", desc);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta("name", "description", DEFAULT_DESCRIPTION);
      upsertMeta("property", "og:title", DEFAULT_TITLE);
      upsertMeta("property", "og:description", DEFAULT_DESCRIPTION);
      upsertMeta("property", "og:type", "website");
      upsertMeta("property", "og:site_name", SITE_NAME);
      upsertMeta("name", "twitter:card", "summary");
      upsertMeta("name", "twitter:title", DEFAULT_TITLE);
      upsertMeta("name", "twitter:description", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}