import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

/**
 * PullToRefresh — wraps content with a swipe-down-to-refresh gesture.
 * Calls onRefresh() when the user pulls past the threshold at the top
 * of the scroll container.
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullDistRef = useRef(0);
  const containerRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);

  const THRESHOLD = 70;

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (window.scrollY > 0 || isRefreshing) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const handleTouchMove = (e) => {
      if (!pullingRef.current) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff > 0) {
        e.preventDefault();
        const dist = Math.min(diff * 0.5, THRESHOLD * 1.5);
        pullDistRef.current = dist;
        setPullDistance(dist);
      }
    };

    const handleTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullDistRef.current >= THRESHOLD) {
        setIsRefreshing(true);
        pullDistRef.current = THRESHOLD;
        setPullDistance(THRESHOLD);
        try {
          await onRefreshRef.current?.();
        } finally {
          setIsRefreshing(false);
          pullDistRef.current = 0;
          setPullDistance(0);
        }
      } else {
        pullDistRef.current = 0;
        setPullDistance(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isRefreshing]);

  return (
    <div ref={containerRef} style={{ touchAction: "pan-y" }}>
      <motion.div
        animate={{ y: isRefreshing ? THRESHOLD : pullDistance }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {(pullDistance > 0 || isRefreshing) && (
          <div className="flex items-center justify-center" style={{ height: pullDistance || (isRefreshing ? THRESHOLD : 0) }}>
            <RefreshCw className={`h-5 w-5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
}