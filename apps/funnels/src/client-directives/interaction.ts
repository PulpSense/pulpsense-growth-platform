import type { ClientDirective } from "astro";

const interactionEvents = [
  "pointerover",
  "pointerdown",
  "focusin",
  "keydown",
  "scroll",
  "touchstart",
] as const;

const interactionDirective: ClientDirective = (load, options) => {
  let hydration: Promise<void> | undefined;
  let hydrated = false;
  let idleCallbackId: number | undefined;
  let timeoutId: number | undefined;
  const cleanup = () => {
    for (const eventName of interactionEvents) {
      window.removeEventListener(eventName, startHydration);
    }
    window.removeEventListener("click", interceptClick, true);
    if (idleCallbackId !== undefined) {
      window.cancelIdleCallback(idleCallbackId);
    }
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
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

  if (options.value === "idle") {
    if (window.requestIdleCallback) {
      idleCallbackId = window.requestIdleCallback(startHydration, {
        timeout: 2_000,
      });
    } else {
      timeoutId = window.setTimeout(startHydration, 2_000);
    }
  }
};

export default interactionDirective;
