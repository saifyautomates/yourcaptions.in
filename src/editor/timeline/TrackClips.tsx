import { useTimelineStore } from '../store/timelineStore';
import { ClipComponent } from './Clip';

interface Props {
  trackId: string;
}

export function TrackClips({ trackId }: Props) {
  const { getTrackClips } = useTimelineStore();
  const clips = getTrackClips(trackId);

  return (
    <>
      {clips.map(clip => (
        <ClipComponent key={clip.id} clip={clip} />
      ))}
    </>
  );
}
