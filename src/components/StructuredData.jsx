import React from "react";

/**
 * Injects JSON-LD structured data into the document.
 * Renders a <script type="application/ld+json"> tag with the
 * provided data object, suitable for search engine rich results.
 */
export default function StructuredData({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}