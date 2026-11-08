import { useEffect, useState } from "react";

/** SVG(グラフ)に渡すため、CSS 変数の色を実際の値で読む */
export function useThemeColors() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
    return {
      primary: v("--c-primary", "#486A64"),
      accent: v("--c-accent", "#C88F91"),
      line: v("--c-line", "#E4E1DA"),
      muted: v("--c-muted", "#5C6763"),
      surface: v("--c-surface", "#FFFFFF"),
      text: v("--c-text", "#273330")
    };
  };
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}
