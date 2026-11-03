/**
 * Shared bits of the marketing-site ScrollSmoother (components/smooth-scroll.tsx).
 * Kept free of GSAP so scroll-driven components can import them cheaply.
 */

/**
 * Fired on window for every smoothed frame. Native `scroll` events stop when
 * the wheel stops, but the smoothed content keeps gliding; components that read
 * on-screen positions (getBoundingClientRect) listen to this too.
 */
export const SMOOTH_SCROLL_EVENT = "bf:smoothscroll";

/**
 * Marks an element whose CSS `position: sticky` should be emulated while
 * ScrollSmoother runs (its transformed content breaks native sticky).
 * The element keeps its sticky CSS, so it works natively without smoothing.
 */
export const STICKY_ATTR = "data-smooth-sticky";

/**
 * The offset native sticky would apply, in px.
 * @param top        the element's resolved CSS `top`
 * @param layoutTop  viewport y of the element's untranslated box
 * @param height     the element's height
 * @param limitBottom viewport y of its containing block's content-box bottom
 */
export function stickyShift(top: number, layoutTop: number, height: number, limitBottom: number) {
  return Math.max(0, Math.min(top - layoutTop, limitBottom - (layoutTop + height)));
}
