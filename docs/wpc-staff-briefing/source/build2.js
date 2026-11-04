const L = require("./lib.js");
const { applyTheme } = require("/root/.claude/skills/synced/b3181c51-b2a0-4dbb-ac4c-7e6d31e71a93_7d03ec08-2ff4-4214-b7fb-7bb0b9c539af/pptx/scripts/apply_theme.js");
(async () => {
  await require("./slides_a.js")();
  await require("./slides_b.js")();
  const OUT = process.argv[2];
  await L.pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, L.THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
