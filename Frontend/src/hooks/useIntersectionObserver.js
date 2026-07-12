import { useState, useEffect, useRef } from "react";

export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIntersecting] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIntersecting(true);
        // Once it's visible, we can stop observing if we only care about the initial load
        if (options.triggerOnce) {
          observer.unobserve(entry.target);
        }
      } else if (!options.triggerOnce) {
        setIntersecting(false);
      }
    }, options);

    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [options.root, options.rootMargin, options.threshold, options.triggerOnce]);

  return [targetRef, isIntersecting];
}
