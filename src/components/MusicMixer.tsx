import { useEffect } from "react";
import { musicEngine } from "@/lib/musicEngine";
import { useMusicState } from "@/lib/musicStore";

type Props = {
  projectId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
};

/** Invisible bridge: keeps the WebAudio engine in sync with the video element and store. */
export const MusicMixer = ({ projectId, videoRef }: Props) => {
  const state = useMusicState(projectId);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || state.tracks.length === 0) return;
    musicEngine.attach(v);
    return () => { musicEngine.detach(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef.current, state.tracks.length]);

  useEffect(() => {
    musicEngine.setState(state);
  }, [state]);

  return null;
};

export default MusicMixer;
