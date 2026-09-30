// PetPal's motion language. Every movement answers one question:
// what happened, where did I land, or what can I do next.
// Short, interruptible springs; nothing loops; with reduced motion,
// MotionConfig turns transforms off and only opacity remains.

// Default for anything the person touches: selections, presses, sheets.
export const spring = { type: 'spring', stiffness: 460, damping: 38, mass: 1 };
// Larger surfaces that travel further: pages, cards leaving the stack.
export const springPage = { type: 'spring', stiffness: 340, damping: 36, mass: 1 };
export const ease = [0.22, 1, 0.36, 1];

// Tapping gives the finger an immediate answer.
export const press = { scale: 0.97 };

// Switching tabs: the old view steps back, the new one settles in place.
export const fadeThrough = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease } },
  exit: { opacity: 0, transition: { duration: 0.09, ease: 'linear' } },
};

// Opening a page: it arrives from the side it will leave by.
export const push = {
  initial: { x: '100%' },
  animate: { x: 0, transition: springPage },
  exit: { x: '100%', transition: { duration: 0.24, ease } },
};

// Lists read as one movement on first appearance only.
export const list = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } } };
export const listItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.26, ease } } };

// Content that grows open, such as a form section or details panel.
export const expand = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { height: spring, opacity: { duration: 0.18, delay: 0.05 } } },
  exit: { opacity: 0, height: 0, transition: { height: { duration: 0.2, ease }, opacity: { duration: 0.1 } } },
};
