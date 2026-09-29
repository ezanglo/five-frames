import MarketingOpenGraphImage from "../../(marketing)/opengraph-image";

/**
 * The demo lives outside the marketing route group (decision D14), so it doesn't inherit that
 * group's share image; it renders the same one. Build-time only — no data access.
 */
export const alt = "FiveFrames — Every guest. Five frames. One shared story.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default MarketingOpenGraphImage;
