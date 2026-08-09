import type { VideoConfig } from '@/components/sections/types';

import { VideoEmbed } from './VideoEmbed';

type VideoPlaceholderProps = {
  video?: VideoConfig;
  priority?: boolean;
  showSoundAlert?: boolean;
};

const VideoPlaceholder = ({
  video,
  priority,
  showSoundAlert = false,
}: VideoPlaceholderProps) => {
  return (
    <div className="w-full overflow-hidden rounded-lg shadow-2xl">
      {showSoundAlert && (
        <div className="w-full bg-red-500 py-2 text-center">
          <span className="text-sm font-bold text-white">
            🔊 Make Sure Sound Is Turned On (Please Wait For Video To Fully
            Load!)
          </span>
        </div>
      )}
      <VideoEmbed video={video ?? {}} priority={priority} />
    </div>
  );
};

export { VideoPlaceholder };
