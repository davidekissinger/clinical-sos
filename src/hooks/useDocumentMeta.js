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

function upsertCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets document.title, meta description, Open Graph tags, Twitter Card
 * tags, and a canonical URL while the calling component is mounted.
 * Restores defaults on unmount.
 */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    const fullTitle = title || DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;
    const canonicalUrl = typeof window !== "undefined" ? window.location.href : undefined;

    document.title = fullTitle;

    upsertMeta("name", "description", desc);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    if (canonicalUrl) {
      upsertMeta("property", "og:url", canonicalUrl);
      upsertCanonical(canonicalUrl);
    }

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
      if (canonicalUrl) {
        upsertMeta("property", "og:url", canonicalUrl);
        upsertCanonical(canonicalUrl);
      }
      upsertMeta("name", "twitter:card", "summary");
      upsertMeta("name", "twitter:title", DEFAULT_TITLE);
      upsertMeta("name", "twitter:description", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}