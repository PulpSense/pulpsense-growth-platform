export type DeferredMediaRuntime = {
  isPageLoaded(): boolean;
  addLoadListener(listener: () => void): () => void;
  addInteractionListener(listener: () => void): () => void;
  requestIdle(listener: () => void): number;
  cancelIdle(id: number): void;
};

type PageLoadRuntime = Omit<DeferredMediaRuntime, "addInteractionListener">;

export function scheduleAfterPageLoad(
  callback: () => void,
  runtime: PageLoadRuntime,
) {
  let idleId: number | undefined;
  let removeLoadListener: () => void = () => undefined;

  const scheduleIdle = () => {
    removeLoadListener();
    idleId = runtime.requestIdle(callback);
  };

  if (runtime.isPageLoaded()) {
    scheduleIdle();
  } else {
    removeLoadListener = runtime.addLoadListener(scheduleIdle);
  }

  return () => {
    removeLoadListener();
    if (idleId !== undefined) runtime.cancelIdle(idleId);
  };
}

export function scheduleNonCriticalMedia(
  callback: () => void,
  runtime: DeferredMediaRuntime,
) {
  let idleId: number | undefined;
  let removeLoadListener: () => void = () => undefined;
  let removeInteractionListener: () => void = () => undefined;
  let pageLoaded = runtime.isPageLoaded();
  let interacted = false;

  const scheduleIdleIfReady = () => {
    if (!pageLoaded || !interacted || idleId !== undefined) return;
    removeLoadListener();
    removeInteractionListener();
    idleId = runtime.requestIdle(callback);
  };

  if (!pageLoaded) {
    removeLoadListener = runtime.addLoadListener(() => {
      removeLoadListener();
      removeLoadListener = () => undefined;
      pageLoaded = true;
      scheduleIdleIfReady();
    });
  }
  removeInteractionListener = runtime.addInteractionListener(() => {
    removeInteractionListener();
    removeInteractionListener = () => undefined;
    interacted = true;
    scheduleIdleIfReady();
  });

  return () => {
    removeLoadListener();
    removeInteractionListener();
    if (idleId !== undefined) runtime.cancelIdle(idleId);
  };
}
