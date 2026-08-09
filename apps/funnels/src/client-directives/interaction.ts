import type { ClientDirective } from "astro";

const interactionEvents = [
  "pointerover",
  "pointerdown",
  "focusin",
  "keydown",
  "scroll",
  "touchstart",
] as const;

const interactionDirective: ClientDirective = (load) => {
  let hydration: Promise<void> | undefined;
  let hydrated = false;
  const cleanup = () => {
    for (const eventName of interactionEvents) {
      window.removeEventListener(eventName, startHydration);
    }
    window.removeEventListener("click", interceptClick, true);
  };
  const startHydration = () => {
    hydration ??= (async () => {
      const loadComponent = await load();
      await loadComponent();
      hydrated = true;
      cleanup();
    })();
    return hydration;
  };
  const interceptClick = async (event: MouseEvent) => {
    if (hydrated) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            'a,button,input,select,textarea,[role="button"]',
          )
        : undefined;
    await startHydration();
    target?.click();
  };

  for (const eventName of interactionEvents) {
    window.addEventListener(eventName, startHydration, {
      passive: true,
    });
  }
  window.addEventListener("click", interceptClick, {
    capture: true,
  });
};

export default interactionDirective;
