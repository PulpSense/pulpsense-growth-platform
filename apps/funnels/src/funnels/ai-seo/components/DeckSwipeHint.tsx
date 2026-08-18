import "../styles/deck-swipe-hint.css";

export function DeckSwipeHint() {
  return (
    <span className="pr-deck-swipe-hint" aria-hidden="true">
      <svg
        className="pr-deck-swipe-trail"
        viewBox="0 0 120 72"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="pr-deck-swipe-trail-reveal" maskUnits="userSpaceOnUse">
            <path
              className="pr-deck-swipe-trail-reveal"
              d="M108 54 Q 72 49, 40 30"
              pathLength="1"
            />
          </mask>
        </defs>
        <path
          className="pr-deck-swipe-trail-ribbon"
          d="M108 50.5 Q 72 44, 40 29 Q 72 51, 108 57.5 Z"
          mask="url(#pr-deck-swipe-trail-reveal)"
        />
      </svg>
      <span className="pr-deck-swipe-contact" />
      <span className="pr-deck-swipe-label">Slide</span>
      <img
        className="pr-deck-swipe-pointer"
        src="/ai-seo/images/tap-mouse.svg"
        alt=""
      />
    </span>
  );
}
