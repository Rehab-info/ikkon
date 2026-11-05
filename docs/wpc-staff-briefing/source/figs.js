const N = "#1E3A5F", A = "#3A7BBF", W = 13;
const st = `stroke="${N}" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
const ac = `stroke="${A}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
const head = (x, y) => `<circle cx="${x}" cy="${y}" r="22" fill="${N}"/>`;
const floor = `<line x1="15" y1="272" x2="285" y2="272" stroke="#9FB6CF" stroke-width="6" stroke-linecap="round"/>`;
const arrowH = (x1, x2, y) => `<path d="M${x1} ${y} H${x2} M${x1 + 14} ${y - 11} L${x1} ${y} L${x1 + 14} ${y + 11} M${x2 - 14} ${y - 11} L${x2} ${y} L${x2 - 14} ${y + 11}" ${ac}/>`;
const wrap = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">${b}</svg>`;
module.exports = {
  twostep: wrap(floor + head(150, 52) + `<path d="M150 78 L150 160 M150 100 L112 140 M150 100 L190 132 M150 160 L202 214 L246 266 M150 160 L108 214 L58 266" ${st}/>` + arrowH(58, 246, 290)),
  seated: wrap(floor + `<path d="M70 168 H175 M80 168 V72 M85 168 V268 M170 168 V268" stroke="#7F97B2" stroke-width="10" stroke-linecap="round" fill="none"/>` + head(128, 58) + `<path d="M126 82 L118 162 L208 166 L222 262 L250 262 M124 104 L156 146 L172 166" ${st}/>` + arrowH(198, 286, 290)),
  standup: wrap(floor + `<rect x="40" y="186" width="96" height="84" rx="6" fill="#BFD8F0" stroke="#7F97B2" stroke-width="6"/>` + head(178, 52) + `<path d="M178 78 L178 168 M158 108 L200 126 M200 108 L158 126 M178 168 L168 266 M178 168 L194 266" ${st}/>` + `<path d="M248 236 V96 M234 112 L248 96 L262 112" ${ac}/>`),
  sts: wrap(floor + `<path d="M40 176 H120 M50 176 V84 M55 176 V268 M115 176 V268" stroke="#7F97B2" stroke-width="10" stroke-linecap="round" fill="none"/>` + head(160, 52) + `<path d="M160 78 L160 166 M140 106 L182 124 M182 106 L140 124 M160 166 L150 266 M160 166 L176 266" ${st}/>` + `<path d="M240 100 V236 M226 116 L240 100 L254 116 M226 220 L240 236 L254 220" ${ac}/>`),
  oneleg: wrap(floor + head(150, 48) + `<path d="M150 72 L150 166 M150 96 L116 122 L134 156 M150 96 L184 122 L166 156 M150 166 L150 268 M150 166 L188 206 L170 238" ${st}/>`),
};
