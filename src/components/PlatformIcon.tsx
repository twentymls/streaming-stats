import {
  SiSpotify,
  SiApplemusic,
  SiYoutube,
  SiTiktok,
  SiShazam,
  SiSoundcloud,
  SiInstagram,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { DSP_COLORS } from "../lib/constants";

const PLATFORM_ICONS: Record<string, IconType> = {
  spotify: SiSpotify,
  apple_music: SiApplemusic,
  youtube: SiYoutube,
  tiktok: SiTiktok,
  shazam: SiShazam,
  soundcloud: SiSoundcloud,
  instagram: SiInstagram,
};

export function PlatformIcon({ source, size = 20 }: { source: string; size?: number }) {
  const Icon = PLATFORM_ICONS[source];
  const color = DSP_COLORS[source] ?? "#888";

  if (!Icon) {
    return (
      <span
        className="platform-icon"
        style={{ width: size, height: size, backgroundColor: color, borderRadius: 3 }}
      />
    );
  }

  return <Icon size={size} color={color} className="platform-icon" />;
}
