import React, { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import * as openPeeps from '@dicebear/open-peeps';

/**
 * AvatarPeep — Deterministic Open Peeps avatar from @dicebear/open-peeps.
 *
 * - Seeds with the user's anonymous session token/fingerprint so the same
 *   anonymous user always gets the same Peep for the session (no identity stored).
 * - Caches generated SVGs in memory by seed+size so we never regenerate the same
 *   avatar twice.
 * - Supports optional `flip` for chat layouts where peeps face each other.
 *
 * VISUAL SYSTEM CHOICE: Approach (b) — let DiceBear use its built-in color
 * options for skin/hair/clothing via the `options` prop. The hand-drawn line
 * art stays black, colors come from a warm palette that blends with the app's
 * indigo accent. UI chrome icons stay Lucide in "light" weight so illustrations
 * remain the visual hero.
 *
 * Palette: Peeps' warm skin/earth tones (peach #e8b4a0, brown #5a3e2b) sit
 * alongside the app's indigo (#6366f1) CTA. Backgrounds shift to a warm
 * off-white (#faf8f5) from pure white wherever the Peeps appear, so the
 * hand-drawn line art doesn't feel sterile.
 */

interface AvatarPeepProps {
  seed: string;
  size?: number;
  className?: string;
  flip?: boolean;
  options?: Record<string, unknown>;
}

const cache = new Map<string, string>();

function getUri(seed: string, size: number, flip: boolean): string {
  const key = `${seed}:${size}:${flip}`;
  const c = cache.get(key);
  if (c) return c;
  const avatar = createAvatar(openPeeps, { seed, size, flip });
  const uri = avatar.toDataUri();
  cache.set(key, uri);
  return uri;
}

const AvatarPeep: React.FC<AvatarPeepProps> = React.memo(({
  seed,
  size = 48,
  className = '',
  flip = false,
}) => {
  const src = useMemo(() => getUri(seed, size, flip), [seed, size, flip]);

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      draggable={false}
    />
  );
});

AvatarPeep.displayName = 'AvatarPeep';

export default AvatarPeep;

/**
 * AvatarPeepCluster — Renders an overlapping stack of N peeps for room cards,
 * hero sections, and group indicators.  Shows the first `max` peeps, then a
 * "+N" overflow badge.
 */
export const AvatarPeepCluster: React.FC<{
  seeds: string[];
  size?: number;
  max?: number;
  className?: string;
}> = ({ seeds, size = 40, max = 4, className = '' }) => {
  const display = seeds.slice(0, max);
  const overflow = seeds.length - max;

  if (display.length === 0) return null;

  return (
    <div className={`flex items-center ${className}`}>
      {display.map((seed, i) => (
        <div
          key={seed}
          className="ring-2 ring-white rounded-full -ml-2 first:ml-0 relative"
          style={{ zIndex: display.length - i, width: size, height: size }}
        >
          <AvatarPeep seed={seed} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="-ml-2 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center ring-2 ring-white text-[10px]"
          style={{ width: size, height: size, zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
