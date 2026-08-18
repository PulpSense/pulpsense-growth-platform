const turnstileUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function initializeDeferredTurnstile(targetSelector?: string) {
  const script = document.querySelector<HTMLScriptElement>(
    "script[data-pulpsense-turnstile]",
  );
  if (!script) return;
  const target = targetSelector ?? script.dataset.target;
  if (!target) return;
  const form = document.querySelector(target);
  if (!form) return;

  let observer: IntersectionObserver | undefined;
  const load = () => {
    if (script.dataset.status !== "deferred") return;
    script.dataset.status = "loading";

    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://challenges.cloudflare.com";
    preconnect.crossOrigin = "anonymous";
    document.head.append(preconnect);

    const loader = document.createElement("script");
    loader.defer = true;
    loader.addEventListener(
      "load",
      () => {
        script.dataset.status = "ready";
        script.dispatchEvent(new Event("load"));
        window.dispatchEvent(
          new CustomEvent("pulpsense:turnstile-script-state", {
            detail: "ready",
          }),
        );
      },
      { once: true },
    );
    loader.addEventListener(
      "error",
      () => {
        script.dataset.status = "error";
        script.dispatchEvent(new Event("error"));
        window.dispatchEvent(
          new CustomEvent("pulpsense:turnstile-script-state", {
            detail: "error",
          }),
        );
      },
      { once: true },
    );
    loader.src = turnstileUrl;
    document.head.append(loader);
    observer?.disconnect();
  };

  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(form);
  } else {
    window.addEventListener("load", load, { once: true });
  }
}
