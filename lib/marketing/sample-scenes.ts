/**
 * Illustrated stand-ins for guest photos inside the marketing site's product mockups. FiveFrames
 * has no approved event photography yet (a recorded asset gap — docs/progress.md), and stock
 * photography would misrepresent real guests, so these are simple flat illustrations: obviously
 * not photographs, and nothing anyone could mistake for a real event's media. Inline SVG data
 * URIs, like the demo's samples (lib/demo/samples.ts): no network request, no public/ asset.
 *
 * The fills are illustration colors, not UI tokens — they sit inside a "photo", the same way the
 * demo's sample images do.
 */

export type SampleScene = { id: string; label: string; src: string };

function svg(body: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

const balloons = svg(
  `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbd6c2"/><stop offset="1" stop-color="#f2a98f"/></linearGradient></defs>` +
    `<rect width="400" height="500" fill="url(#a)"/>` +
    `<path d="M150 250 Q160 330 140 420 M250 230 Q245 330 262 430 M205 190 Q215 300 200 440" stroke="#ffffff" stroke-opacity=".7" stroke-width="3" fill="none"/>` +
    `<ellipse cx="150" cy="200" rx="58" ry="70" fill="#8a5cf6"/><ellipse cx="250" cy="175" rx="62" ry="74" fill="#f06b8b"/><ellipse cx="205" cy="125" rx="54" ry="64" fill="#ffc94d"/>` +
    `<ellipse cx="132" cy="178" rx="12" ry="20" fill="#fff" fill-opacity=".35"/><ellipse cx="232" cy="150" rx="12" ry="20" fill="#fff" fill-opacity=".35"/><ellipse cx="190" cy="105" rx="10" ry="17" fill="#fff" fill-opacity=".4"/>`,
);

const cake = svg(
  `<rect width="400" height="500" fill="#2a2140"/>` +
    `<circle cx="200" cy="170" r="150" fill="#ffb347" fill-opacity=".18"/>` +
    `<rect x="95" y="300" width="210" height="120" rx="14" fill="#f7e3d3"/><rect x="95" y="300" width="210" height="34" rx="14" fill="#f4a3b8"/>` +
    `<rect x="120" y="250" width="160" height="60" rx="12" fill="#fff1e6"/><rect x="120" y="250" width="160" height="20" rx="10" fill="#f4a3b8"/>` +
    `<rect x="155" y="200" width="8" height="52" rx="3" fill="#b99cff"/><rect x="196" y="192" width="8" height="60" rx="3" fill="#8ee0c2"/><rect x="237" y="200" width="8" height="52" rx="3" fill="#ffd166"/>` +
    `<ellipse cx="159" cy="190" rx="7" ry="12" fill="#ffcf5a"/><ellipse cx="200" cy="181" rx="7" ry="12" fill="#ffcf5a"/><ellipse cx="241" cy="190" rx="7" ry="12" fill="#ffcf5a"/>` +
    `<rect x="60" y="415" width="280" height="14" rx="7" fill="#fff" fill-opacity=".25"/>`,
);

const sunset = svg(
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a8b"/><stop offset=".55" stop-color="#ffcf8a"/><stop offset=".56" stop-color="#3d5a8a"/><stop offset="1" stop-color="#23355c"/></linearGradient></defs>` +
    `<rect width="400" height="500" fill="url(#s)"/>` +
    `<circle cx="200" cy="275" r="62" fill="#fff4d6"/>` +
    `<rect x="0" y="278" width="400" height="222" fill="#2f4a78"/>` +
    `<rect x="140" y="300" width="120" height="6" rx="3" fill="#ffe0a3" fill-opacity=".7"/><rect x="160" y="320" width="80" height="5" rx="2.5" fill="#ffe0a3" fill-opacity=".5"/><rect x="175" y="338" width="50" height="4" rx="2" fill="#ffe0a3" fill-opacity=".35"/>` +
    `<circle cx="95" cy="410" r="16" fill="#1a2744"/><rect x="80" y="424" width="30" height="76" rx="14" fill="#1a2744"/><circle cx="135" cy="416" r="14" fill="#1a2744"/><rect x="122" y="428" width="26" height="72" rx="12" fill="#1a2744"/>`,
);

const lights = svg(
  `<rect width="400" height="500" fill="#1c1830"/>` +
    `<path d="M-10 90 Q100 170 200 110 T410 120" stroke="#6d6690" stroke-width="2" fill="none"/>` +
    `<path d="M-10 230 Q120 300 210 240 T410 250" stroke="#6d6690" stroke-width="2" fill="none"/>` +
    Array.from({ length: 9 }, (_, i) => {
      const x = 20 + i * 46;
      const y1 = 120 + Math.sin(i * 0.9) * 26;
      const y2 = 262 + Math.cos(i * 0.8) * 22;
      return `<circle cx="${x}" cy="${y1}" r="16" fill="#ffd27a" fill-opacity=".22"/><circle cx="${x}" cy="${y1}" r="6" fill="#ffe3a3"/><circle cx="${x + 20}" cy="${y2}" r="16" fill="#ffb3c7" fill-opacity=".2"/><circle cx="${x + 20}" cy="${y2}" r="6" fill="#ffd0dc"/>`;
    }).join("") +
    `<rect x="70" y="360" width="80" height="140" rx="36" fill="#2c2548"/><circle cx="110" cy="345" r="28" fill="#2c2548"/>` +
    `<rect x="240" y="370" width="90" height="130" rx="40" fill="#2c2548"/><circle cx="285" cy="350" r="30" fill="#2c2548"/>`,
);

const confetti = svg(
  `<rect width="400" height="500" fill="#ffe89a"/>` +
    Array.from({ length: 34 }, (_, i) => {
      const colors = ["#6b2bd9", "#f06b8b", "#3fb8a5", "#ff8a4c", "#4c7df0"];
      const x = (i * 97) % 400;
      const y = (i * 61) % 500;
      const r = (i * 37) % 180;
      return `<rect x="${x}" y="${y}" width="16" height="7" rx="2" fill="${colors[i % colors.length]}" transform="rotate(${r} ${x + 8} ${y + 3})"/>`;
    }).join("") +
    `<circle cx="200" cy="250" r="86" fill="#fff" fill-opacity=".55"/><path d="M160 262 Q200 300 240 262" stroke="#3a2a10" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="172" cy="228" r="8" fill="#3a2a10"/><circle cx="228" cy="228" r="8" fill="#3a2a10"/>`,
);

const mountains = svg(
  `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#e9f5ff"/></linearGradient></defs>` +
    `<rect width="400" height="500" fill="url(#m)"/>` +
    `<circle cx="300" cy="110" r="34" fill="#fff6d1"/>` +
    `<path d="M-20 360 L110 180 L200 300 L280 200 L420 360 Z" fill="#7aa6c9"/><path d="M110 180 L140 222 L120 214 L100 230 Z" fill="#fff"/><path d="M280 200 L305 235 L285 228 L265 240 Z" fill="#fff"/>` +
    `<path d="M-20 500 L-20 350 Q100 320 200 360 T420 340 L420 500 Z" fill="#5f9e7a"/>` +
    `<rect x="180" y="380" width="40" height="70" rx="18" fill="#ff8a4c"/><circle cx="200" cy="366" r="18" fill="#6a4630"/>`,
);

const toast = svg(
  `<rect width="400" height="500" fill="#2f6f6a"/>` +
    `<circle cx="200" cy="170" r="130" fill="#ffffff" fill-opacity=".06"/>` +
    `<g transform="rotate(-14 150 260)"><path d="M115 150 L185 150 L178 260 Q150 280 122 260 Z" fill="#fff" fill-opacity=".85"/><path d="M119 190 L181 190 L178 260 Q150 280 122 260 Z" fill="#ffc34d"/><rect x="146" y="272" width="8" height="90" fill="#fff" fill-opacity=".85"/><rect x="118" y="358" width="64" height="10" rx="5" fill="#fff" fill-opacity=".85"/></g>` +
    `<g transform="rotate(14 250 260)"><path d="M215 150 L285 150 L278 260 Q250 280 222 260 Z" fill="#fff" fill-opacity=".85"/><path d="M219 190 L281 190 L278 260 Q250 280 222 260 Z" fill="#ff8fa3"/><rect x="246" y="272" width="8" height="90" fill="#fff" fill-opacity=".85"/><rect x="218" y="358" width="64" height="10" rx="5" fill="#fff" fill-opacity=".85"/></g>` +
    `<circle cx="200" cy="128" r="5" fill="#fff"/><circle cx="182" cy="110" r="3.5" fill="#fff"/><circle cx="220" cy="106" r="3.5" fill="#fff"/>`,
);

const table = svg(
  `<rect width="400" height="500" fill="#f3e6da"/>` +
    `<ellipse cx="200" cy="330" rx="210" ry="120" fill="#c98b5e"/>` +
    `<circle cx="120" cy="300" r="46" fill="#fff"/><circle cx="120" cy="300" r="30" fill="#f4c26b"/><circle cx="280" cy="300" r="46" fill="#fff"/><circle cx="280" cy="300" r="30" fill="#8cc084"/>` +
    `<circle cx="200" cy="370" r="50" fill="#fff"/><circle cx="200" cy="370" r="34" fill="#e8795b"/>` +
    `<rect x="60" y="80" width="70" height="140" rx="32" fill="#6b4e9b"/><circle cx="95" cy="62" r="28" fill="#8a5a3c"/>` +
    `<rect x="270" y="80" width="70" height="140" rx="32" fill="#3f7fb4"/><circle cx="305" cy="62" r="28" fill="#5a3a26"/>` +
    `<rect x="165" y="60" width="70" height="150" rx="32" fill="#e0607e"/><circle cx="200" cy="42" r="28" fill="#6e4a32"/>`,
);

export const SAMPLE_SCENES: readonly SampleScene[] = [
  { id: "balloons", label: "Illustration: balloons", src: balloons },
  { id: "cake", label: "Illustration: birthday cake with candles", src: cake },
  { id: "sunset", label: "Illustration: friends watching a sunset", src: sunset },
  { id: "lights", label: "Illustration: string lights at night", src: lights },
  { id: "confetti", label: "Illustration: confetti", src: confetti },
  { id: "mountains", label: "Illustration: a trip to the mountains", src: mountains },
  { id: "toast", label: "Illustration: two glasses raised in a toast", src: toast },
  { id: "table", label: "Illustration: friends around a shared table", src: table },
];

export function scene(index: number): SampleScene {
  return SAMPLE_SCENES[index % SAMPLE_SCENES.length];
}
