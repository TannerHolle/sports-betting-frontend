/**
 * Contrast-safe team colors.
 *
 * ESPN's `team.color` is a brand color, not usable ink. Some teams ship values
 * that disappear against a light card — Charlotte's primary is literally
 * `ffffff` (1.03:1 against paper), the Saints' is `d3bc8d`, Missouri's
 * `f1b82d`. The old `getTeamStyle()` painted those straight into a
 * `border-left`, so those teams simply had no visible identity marker.
 *
 * Fix: keep the team's HUE and move its LIGHTNESS until it clears a contrast
 * floor. Order matters — falling back to `alternateColor` first (the obvious
 * approach) turns the Giants red and the Bears orange, which is worse than the
 * bug. The alternate is only correct when the primary carries no hue at all.
 *
 * Both the light and dark rail are computed up front and emitted as two custom
 * properties, so switching theme is a pure CSS swap with no re-render.
 */

const GROUND_LIGHT = '#faf9f6';
const GROUND_DARK = '#15120f';
const DEFAULT_FLOOR = 3;
// the two inks a filled team-colored chip can carry (paper / ink from style.css)
const INK_ON_COLOR_LIGHT = '#faf9f6';
const INK_ON_COLOR_DARK = '#231d18';

/** Normalize `"0b1c3a"`, `"#0b1c3a"` or `"abc"` to `"#0b1c3a"`; null if unusable. */
export function normalizeHex(value) {
  if (!value) return null;
  let s = String(value).replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(s) ? `#${s.toLowerCase()}` : null;
}

function toRgb(hex) {
  const n = String(hex).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return `#${rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG relative luminance. */
export function luminance(hex) {
  return toRgb(normalizeHex(hex) || '#000000')
    .map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, v, i) => acc + [0.2126, 0.7152, 0.0722][i] * v, 0);
}

/** WCAG contrast ratio between two luminances. */
export function contrastRatio(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** True when a color is effectively white, black or gray — no hue to preserve. */
function isAchromatic(hex) {
  const c = toRgb(hex);
  return Math.max(...c) - Math.min(...c) < 25;
}

/**
 * Pick a team color that clears `floor` against `ground`.
 *
 * @param {string} primary      team.color from the ESPN payload
 * @param {string} alternate    team.alternateColor
 * @param {string} ground       the background it will sit on
 * @param {number} [floor=3]    minimum contrast ratio
 * @returns {string} a hex color that clears the floor
 */
export function railColor(primary, alternate, ground, floor = DEFAULT_FLOOR) {
  const groundLum = luminance(ground);
  const p = normalizeHex(primary);
  const a = normalizeHex(alternate);

  // 1. The primary already reads — the common case, and always preferred.
  if (p && contrastRatio(luminance(p), groundLum) >= floor) return p;

  // 2. Choose what to adjust. Normally that's the primary, so the team keeps
  //    its hue. But when the primary is white/black/gray there is no hue to
  //    preserve, and the alternate is the team's real color — so adjust THAT
  //    instead. Charlotte ships color #ffffff / alternateColor #cfab7a: without
  //    this the white gets darkened into a meaningless gray.
  const preferAlternate = p && isAchromatic(p) && a && !isAchromatic(a);
  const base = preferAlternate ? a : (p || a);
  if (!base) return null;

  // The chosen base may already clear the floor (a usable alternate).
  if (contrastRatio(luminance(base), groundLum) >= floor) return base;

  // 3. Keep the hue, walk the lightness toward the ground's opposite.

  const darken = groundLum > 0.4;
  let rgb = toRgb(base);
  for (let i = 0; i < 24; i += 1) {
    rgb = rgb.map((c) => (darken ? c * 0.88 : c + (255 - c) * 0.12));
    const hex = toHex(rgb);
    if (contrastRatio(luminance(hex), groundLum) >= floor) return hex;
  }
  return darken ? '#000000' : '#ffffff';
}

/**
 * Inline style for a team row. Emits the light and dark rail as custom
 * properties; `style.css` picks which one is live for the current theme.
 *
 * Replaces the old getTeamStyle() — which also painted a gradient wash across
 * the row and a 2px ring on the winner. The wash sat underneath the odds and
 * fought them for attention, so the color is now a 3px rail plus a filled
 * score chip on the winning side.
 *
 * @param {object} competitor an ESPN competitor entry
 * @returns {object} style bindings, or `{}` when the team has no usable color
 */
export function teamRailStyle(competitor) {
  const team = competitor?.team;
  if (!team?.color) return {};

  const light = railColor(team.color, team.alternateColor, GROUND_LIGHT);
  const dark = railColor(team.color, team.alternateColor, GROUND_DARK);
  if (!light && !dark) return {};

  return {
    '--team-rail-light': light,
    '--team-rail-dark': dark || light,
    // The winning score sits ON the rail as a filled chip. A rail only has to
    // clear 3:1 against the page, which leaves plenty of mid-tone colors where
    // neither near-white nor near-black is automatically safe — Charlotte's
    // #a0845e is 2.9:1 against paper-white text. So pick per team.
    '--team-ink-light': readableInk(light),
    '--team-ink-dark': readableInk(dark || light)
  };
}

/** Whichever of the two page inks reads better on `background`. */
export function readableInk(background) {
  if (!background) return INK_ON_COLOR_LIGHT;
  const bg = luminance(background);
  return contrastRatio(luminance(INK_ON_COLOR_LIGHT), bg) >= contrastRatio(luminance(INK_ON_COLOR_DARK), bg)
    ? INK_ON_COLOR_LIGHT
    : INK_ON_COLOR_DARK;
}

export { GROUND_LIGHT, GROUND_DARK };
