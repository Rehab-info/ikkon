import { REQUEST_CLOSING, buildRequestMessage, canRequestAgain, cleanPlayTitle, isRequestTone } from "./request";

describe("もう一度お願いしたい:共有文", () => {
  it("4つのテンプレートに名前だけが入る", () => {
    expect(buildRequestMessage("マッサージ", "gentle", false)).toBe("この前のマッサージ、すごく嬉しかった。また一緒にできたらいいな♡");
    expect(buildRequestMessage("マッサージ", "shy", false)).toBe("直接言うのはちょっと恥ずかしいけど、マッサージをまたお願いしたいな。");
    expect(buildRequestMessage("マッサージ", "discuss", false)).toBe("マッサージが好きだったから、またできたら嬉しい。どう思う？");
    expect(buildRequestMessage("マッサージ", "simple", false)).toBe("マッサージ、またしてみたいな♡");
  });
  it("既定で、相手が返事をしやすい結びを末尾に付ける", () => {
    expect(buildRequestMessage("マッサージ", "simple")).toBe(`マッサージ、またしてみたいな♡\n${REQUEST_CLOSING}`);
  });
  it("名前は1行に整え、空なら文章を作らない", () => {
    expect(cleanPlayTitle("  ゆっくり\n\nハグ  ")).toBe("ゆっくり ハグ");
    expect(cleanPlayTitle("「キス」")).toBe("キス");
    expect(buildRequestMessage("   ", "gentle")).toBe("");
    expect(cleanPlayTitle("あ".repeat(200))).toHaveLength(80);
  });
  it("今は希望しない・苦手なものや、体位・プレイ以外には出さない", () => {
    expect(canRequestAgain({ category: "play", status: "like" })).toBe(true);
    expect(canRequestAgain({ category: "position", status: "discuss" })).toBe(true);
    expect(canRequestAgain({ category: "again", status: "curious" })).toBe(true);
    expect(canRequestAgain({ category: "play", status: "not_now" })).toBe(false);
    expect(canRequestAgain({ category: "play", status: "avoid" })).toBe(false);
    expect(canRequestAgain({ category: "dislike", status: "like" })).toBe(false);
    expect(canRequestAgain({ category: "memo", status: "discuss" })).toBe(false);
  });
  it("トーンの判定", () => {
    expect(isRequestTone("shy")).toBe(true);
    expect(isRequestTone("pushy")).toBe(false);
  });
});
