import { createCn } from "cn/config"

/**
 * Class merging aware of the FiveFrames design tokens (app/globals.css). Without registering
 * them, custom font sizes like `text-button` or `text-label` would be mistaken for text colors
 * and silently drop a real color class such as `text-ink-inverse` in the same call.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero",
            "hero-desktop",
            "display",
            "display-create",
            "display-desktop",
            "title",
            "title-desktop",
            "page-desktop",
            "wizard-desktop",
            "heading",
            "button",
            "body",
            "label",
            "caption",
            "micro",
          ],
        },
      ],
      shadow: [{ shadow: ["glow", "tab", "card"] }],
      rounded: [{ rounded: ["sheet"] }],
      "rounded-t": [{ "rounded-t": ["sheet"] }],
    },
  },
})
