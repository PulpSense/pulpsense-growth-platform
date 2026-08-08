type YouTubePlayerProps = {
  videoId: string;
  priority?: boolean;
};

const YouTubePlayer = ({ videoId, priority }: YouTubePlayerProps) => {
  return (
    <div className="relative aspect-video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading={priority ? 'eager' : 'lazy'}
        className="absolute inset-0 size-full"
      />
    </div>
  );
};

export { YouTubePlayer };
