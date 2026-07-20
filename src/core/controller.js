export function createDeckController(slideCount, initialIndex = 0) {
  if (!Number.isInteger(slideCount) || slideCount < 1) throw new Error("slideCount must be a positive integer.");
  const listeners = new Set();
  const state = {
    index: clamp(initialIndex, 0, slideCount - 1),
    overlay: null,
    notesOpen: false,
  };

  function emit() {
    const snapshot = Object.freeze({ ...state });
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  const controller = {
    getState: () => Object.freeze({ ...state }),
    subscribe(listener) {
      if (typeof listener !== "function") throw new Error("Listener must be a function.");
      listeners.add(listener);
      listener(controller.getState());
      return () => listeners.delete(listener);
    },
    next() {
      state.index = clamp(state.index + 1, 0, slideCount - 1);
      state.overlay = null;
      return emit();
    },
    previous() {
      state.index = clamp(state.index - 1, 0, slideCount - 1);
      state.overlay = null;
      return emit();
    },
    goTo(slideNumber) {
      if (!Number.isInteger(Number(slideNumber))) throw new Error("Slide number must be an integer.");
      state.index = clamp(Number(slideNumber) - 1, 0, slideCount - 1);
      state.overlay = null;
      return emit();
    },
    first() {
      return controller.goTo(1);
    },
    last() {
      return controller.goTo(slideCount);
    },
    showQr() {
      state.overlay = "qr";
      return emit();
    },
    hideOverlay() {
      state.overlay = null;
      return emit();
    },
    toggleNotes() {
      state.notesOpen = !state.notesOpen;
      return emit();
    },
  };
  return Object.freeze(controller);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}
