// Page behaviour shared by every page. Imported once by the Base layout.

// Scroll reveal: each [data-reveal] fades up once, the first time it is seen.
const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      reveal.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -12% 0px' },
);

document.addEventListener('astro:page-load', () => {
  document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => reveal.observe(el));
});

// Liquid Glass: the highlight on a glass button follows the pointer.
// The position is written on the button itself, so nothing else restyles.
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener(
    'pointermove',
    (event) => {
      const glass = (event.target as Element | null)?.closest<HTMLElement>('.btn');
      if (!glass) return;
      const box = glass.getBoundingClientRect();
      glass.style.setProperty('--gx', `${event.clientX - box.left}px`);
      glass.style.setProperty('--gy', `${event.clientY - box.top}px`);
    },
    { passive: true },
  );
}
