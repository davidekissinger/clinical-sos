import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

/**
 * AccessibleDialog — shared modal component with complete focus management.
 *
 * Features:
 * - role="dialog" aria-modal="true"
 * - Focus moves into dialog on open
 * - Tab/Shift+Tab cycles within dialog only (focus trap)
 * - Escape closes
 * - Focus returns to trigger element on close
 * - aria-labelledby connects to title
 */
export default function AccessibleDialog({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  maxWidth = "max-w-md",
  closeLabel = "Close dialog",
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  // Store the currently focused element before the dialog opens
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Move focus into dialog when it opens
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const timer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      if (first) {
        first.focus();
      } else {
        dialog.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Focus trap + Escape handler
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === dialog) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const dialogTitleId = titleId || "dialog-title";

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
          triggerRef.current?.focus();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`bg-white dark:bg-card rounded-xl border border-border p-6 ${maxWidth} w-full max-h-[90vh] overflow-y-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={dialogTitleId} className="font-semibold text-foreground">
            {title}
          </h3>
          <button
            onClick={() => {
              onClose();
              triggerRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-secondary/60"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}