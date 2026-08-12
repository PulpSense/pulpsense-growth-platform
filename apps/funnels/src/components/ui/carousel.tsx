import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import {
  createContext,
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type CarouselApi = UseEmblaCarouselType[1];

type CarouselContextValue = {
  api: CarouselApi;
  canScrollNext: boolean;
  canScrollPrev: boolean;
  scrollNext: () => void;
  scrollPrev: () => void;
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) throw new Error("Carousel components must be inside Carousel");
  return context;
}

type CarouselProps = HTMLAttributes<HTMLDivElement> & {
  opts?: Parameters<typeof useEmblaCarousel>[0];
  plugins?: Parameters<typeof useEmblaCarousel>[1];
  setApi?: (api: CarouselApi) => void;
  children: ReactNode;
};

export const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
  ({ children, className, opts, plugins, setApi, ...props }, ref) => {
    const [emblaRef, api] = useEmblaCarousel(opts, plugins);
    const [canScrollPrev, setCanScrollPrev] = useRefState(false);
    const [canScrollNext, setCanScrollNext] = useRefState(false);

    const onSelect = useCallback(
      (carouselApi: CarouselApi) => {
        if (!carouselApi) return;
        setCanScrollPrev(carouselApi.canScrollPrev());
        setCanScrollNext(carouselApi.canScrollNext());
      },
      [setCanScrollNext, setCanScrollPrev],
    );

    useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on("reInit", onSelect).on("select", onSelect);
      setApi?.(api);
      return () => {
        api.off("reInit", onSelect).off("select", onSelect);
      };
    }, [api, onSelect, setApi]);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        api?.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        api?.scrollNext();
      }
    };

    return (
      <CarouselContext.Provider
        value={{
          api,
          canScrollNext,
          canScrollPrev,
          scrollNext: () => api?.scrollNext(),
          scrollPrev: () => api?.scrollPrev(),
        }}
      >
        <div
          ref={ref}
          className={className}
          role="region"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          {...props}
        >
          <div ref={emblaRef} className="ps-carousel-viewport">
            {children}
          </div>
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

export const CarouselContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`ps-carousel-container ${className ?? ""}`}
    {...props}
  />
));
CarouselContent.displayName = "CarouselContent";

export const CarouselItem = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`ps-carousel-item ${className ?? ""}`}
    role="group"
    {...props}
  />
));
CarouselItem.displayName = "CarouselItem";

export const CarouselPrevious = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { canScrollPrev, scrollPrev } = useCarousel();
  return (
    <button
      ref={ref}
      type="button"
      className={`ps-carousel-previous ${className ?? ""}`}
      disabled={!canScrollPrev}
      aria-label="Previous slide"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) scrollPrev();
      }}
      {...props}
    >
      <span aria-hidden="true">‹</span>
    </button>
  );
});
CarouselPrevious.displayName = "CarouselPrevious";

export const CarouselNext = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { canScrollNext, scrollNext } = useCarousel();
  return (
    <button
      ref={ref}
      type="button"
      className={`ps-carousel-next ${className ?? ""}`}
      disabled={!canScrollNext}
      aria-label="Next slide"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) scrollNext();
      }}
      {...props}
    >
      <span aria-hidden="true">›</span>
    </button>
  );
});
CarouselNext.displayName = "CarouselNext";

function useRefState(initialValue: boolean) {
  return useState(initialValue);
}
