type WistiaPlayerProps = {
  mediaId: string;
  aspect?: number;
  priority?: boolean;
};

const WistiaPlayer = ({
  mediaId,
  aspect = 1.7777777777777777,
  priority,
}: WistiaPlayerProps) => {
  return (
    <div className="relative w-full" style={{ aspectRatio: aspect }}>
      <script src="https://fast.wistia.com/player.js" async={!priority} defer />
      <script
        src={`https://fast.wistia.com/embed/${mediaId}.js`}
        async={!priority}
        defer
        type="module"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            wistia-player[media-id='${mediaId}'] { position: absolute; inset: 0; width: 100%; height: 100%; }
            wistia-player[media-id='${mediaId}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${mediaId}/swatch'); filter: blur(5px); }
          `,
        }}
      />
      {/* @ts-expect-error -- wistia-player is a custom element */}
      <wistia-player media-id={mediaId} aspect={String(aspect)} />
    </div>
  );
};

export { WistiaPlayer };
