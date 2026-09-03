import { useEffect, useRef } from 'react';

// Añade la clase "is-in" cuando el elemento entra en el viewport.
// El elemento debe partir visible (clase "reveal-init" ya en el CSS) para
// que sin JS o con prefers-reduced-motion el contenido nunca quede oculto.
export function useScrollReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      node.classList.add('is-in');
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-in');
          observer.unobserve(node);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}
