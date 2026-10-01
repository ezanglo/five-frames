import type { Ref } from "react";

/**
 * The hidden photo input behind "Take shot" (guest) and "Use your own photo" (demo). One standard
 * `accept="image/*"` input, deliberately **without** `capture`: with `capture`, Android Chrome
 * starts the camera directly and offers no existing photo (web.dev, "Capturing an image from the
 * user"). Without it, Chrome and Safari on iOS and Android offer both the camera and the photo
 * library, which product.md §9.2/§16 require. The system picker stays native; nothing here
 * builds an in-page camera.
 *
 * It only hands the chosen file to `onFile`, which starts the normal preview → Keep flow.
 * Raw HEIC is still not supported (product.md §14): that's decided after the file is chosen.
 */
export function PhotoPickerInput({
  ref,
  onFile,
}: {
  ref: Ref<HTMLInputElement>;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        // Clear it, so choosing the same photo again still fires a change.
        e.target.value = "";
      }}
    />
  );
}
