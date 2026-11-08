import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { destroyDb, getDb } from "./db/db";
import { saveFood, saveGratitude, savePreference, saveSettings } from "./db/repo";
import { todayISO } from "./lib/date";

const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined);

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

async function setup(opts: { adult?: boolean; settings?: Parameters<typeof saveSettings>[1] } = {}) {
  const db = getDb("real");
  if (opts.adult !== false) await saveSettings(db, { adultConfirmed: true, ...opts.settings });
  const user = userEvent.setup();
  // user-event は setup で navigator.clipboard を差し替えるので、その後に入れる
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<App initialMode="real" />);
  return { db, user };
}

beforeEach(async () => {
  await destroyDb("real");
  await destroyDb("demo");
  localStorage.clear();
  window.location.hash = "";
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  // jsdom には共有シートがないので、コピーで送る経路になる
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
});

describe("はじめての起動", () => {
  it("成人の確認をするまで始められない", async () => {
    const { user, db } = await setup({ adult: false });
    const start = await screen.findByRole("button", { name: "はじめる" });
    expect(start).toBeDisabled();
    await user.click(screen.getByLabelText("私は18歳以上です"));
    expect(start).toBeEnabled();
    await user.click(start);
    expect(await screen.findByRole("heading", { name: "今日の自分の状態" })).toBeInTheDocument();
    await waitFor(async () => expect((await db.settings.get("settings"))?.value.adultConfirmed).toBe(true));
  });
});

describe("ホーム", () => {
  it("今日の日付と4つの領域、伝えたいこと、最近の記録を表示する", async () => {
    await setup();
    expect(await screen.findByRole("heading", { name: "記録する" })).toBeInTheDocument();
    for (const n of ["Wellness", "Intimacy", "Food", "Thanks"]) expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "パートナーへ伝えたいこと" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近の記録" })).toBeInTheDocument();
    // 下のナビには Intimacy を置かない
    const nav = screen.getByRole("navigation", { name: "メイン" });
    expect(within(nav).queryByText("Intimacy")).toBeNull();
  });
});

describe("Wellness の記録(0 と未回答の区別)", () => {
  it("0 を選んだ項目は 0、触れていない項目は未回答で保存される", async () => {
    const { user, db } = await setup();
    await go(`#/wellness/edit?date=${todayISO()}`);
    const appetite = await screen.findByRole("group", { name: "食欲" });
    await user.click(within(appetite).getByLabelText("0(まったくない)"));
    const mood = screen.getByRole("group", { name: "気分" });
    await user.click(within(mood).getByLabelText("8"));
    await user.click(within(mood).getByRole("button", { name: "気分を未回答に戻す" }));
    await user.click(within(screen.getByRole("group", { name: "ストレス" })).getByLabelText("3"));
    await user.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(async () => expect(await db.wellness.count()).toBe(1));
    const e = (await db.wellness.toArray())[0]!;
    expect(e.appetite).toBe(0);
    expect(e.stress).toBe(3);
    expect("mood" in e).toBe(false);
    expect("sexualDesire" in e).toBe(false);
  });

  it("性欲の項目は設定で非表示にできる", async () => {
    await setup({ settings: { showSexualDesire: false } });
    await go("#/wellness/edit");
    await screen.findByRole("group", { name: "食欲" });
    expect(screen.queryByRole("group", { name: "性欲" })).toBeNull();
  });
});

describe("Intimacy の非表示", () => {
  it("非表示にするとホーム・Together から消え、URL を直接開いてもホームに戻る。データは残る", async () => {
    const db = getDb("real");
    await savePreference(db, { title: "ゆっくり", category: "play", status: "like" });
    await setup({ settings: { showIntimacy: false } });
    await screen.findByRole("heading", { name: "記録する" });
    expect(screen.queryByText("Intimacy")).toBeNull();
    await go("#/intimacy");
    await waitFor(() => expect(window.location.hash).toBe("#/"));
    await go("#/together");
    await screen.findByRole("heading", { name: "Together" });
    expect(screen.queryByText("好みについて話す")).toBeNull();
    await go("#/share?kind=intimacy");
    await waitFor(() => expect(window.location.hash).toBe("#/"));
    expect(await db.intimacyPreferences.count()).toBe(1);
  });
});

describe("自由記述の HTML・スクリプトは実行されない", () => {
  it("文字列として表示される", async () => {
    const db = getDb("real");
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
    await savePreference(db, { title: payload, category: "memo", status: "discuss" });
    await saveGratitude(db, { date: todayISO(), reason: payload });
    await setup({ settings: { sensitiveBlur: false } });
    await go("#/intimacy");
    expect(await screen.findByText(payload)).toBeInTheDocument();
    await go("#/thanks");
    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.querySelectorAll("script").length).toBe(0);
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("ぼかし設定のとき、Intimacy の内容はタップするまで読み上げ対象にならない", async () => {
    const db = getDb("real");
    await savePreference(db, { title: "ひみつの好み", category: "play", status: "like", tags: ["タグ"] });
    const { user } = await setup();
    await go("#/intimacy");
    const btn = await screen.findByRole("button", { name: "内容を表示" });
    expect(screen.getByText("ひみつの好み").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.queryByText("#タグ")).toBeNull();
    await user.click(btn);
    expect(screen.getByText("ひみつの好み").closest("[aria-hidden]")).toBeNull();
  });
});

describe("共有(プレビューと混入防止)", () => {
  it("Thanks:伝えたいメッセージだけがプレビューされ、コピーで送れる。「伝えた」は自動で付かない", async () => {
    const db = getDb("real");
    const g = await saveGratitude(db, { date: todayISO(), reason: "朝ごはん", feeling: "FEELING_PRIVATE", message: "朝ごはんありがとう" });
    const { user } = await setup();
    await go(`#/share?kind=thanks&ids=${g.id}`);
    await user.click(await screen.findByRole("button", { name: "下書きを作る" }));
    const box = screen.getByLabelText("送る文章");
    expect(box).toHaveValue("朝ごはんありがとう");
    await user.type(box, "！");
    await user.click(screen.getByRole("button", { name: "プレビューへ" }));
    const preview = screen.getByTestId("share-preview");
    expect(preview).toHaveTextContent("朝ごはんありがとう！");
    expect(preview).not.toHaveTextContent("FEELING_PRIVATE");
    expect(screen.getByText(/相手の端末やアプリから YOKU で削除・取り消しすることはできません/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "文章をコピー" }));
    expect(writeText).toHaveBeenCalledWith("朝ごはんありがとう！");
    expect(await screen.findByText(/文章をコピーしました/)).toBeInTheDocument();
    expect((await db.gratitude.get(g.id))?.shared).toBeUndefined();
    await user.click(screen.getByRole("button", { name: /「伝えた」印をつける/ }));
    await waitFor(async () => expect((await db.gratitude.get(g.id))?.shared).toBe(true));
  });

  it("Intimacy:初期状態で何も選ばれておらず、確認しないと送れない。メモは入らない", async () => {
    const db = getDb("real");
    await savePreference(db, { title: "照明の工夫", category: "interest", status: "discuss", notes: "NOTE_PRIVATE", tags: ["TAG_PRIVATE"] });
    await savePreference(db, { title: "選ばない項目", category: "play", status: "like" });
    const { user } = await setup();
    await go("#/share?kind=intimacy");
    const next = await screen.findByRole("button", { name: "下書きを作る" });
    expect(next).toBeDisabled();
    for (const cb of screen.getAllByRole("checkbox")) expect(cb).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /照明の工夫/ }));
    await user.click(next);
    const text = (screen.getByLabelText("送る文章") as HTMLTextAreaElement).value;
    expect(text).toContain("照明の工夫");
    expect(text).not.toContain("NOTE_PRIVATE");
    expect(text).not.toContain("TAG_PRIVATE");
    expect(text).not.toContain("選ばない項目");
    await user.click(screen.getByRole("button", { name: "プレビューへ" }));
    expect(screen.getByText("機微な情報が含まれます")).toBeInTheDocument();
    const copy = screen.getByRole("button", { name: "文章をコピー" });
    expect(copy).toBeDisabled();
    await user.click(screen.getByLabelText("内容と送り先を確認しました"));
    expect(copy).toBeEnabled();
    await user.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).not.toContain("NOTE_PRIVATE");
  });

  it("Food:料理名とお店だけが入り、メモ・同行者・場所は入らない", async () => {
    const db = getDb("real");
    const f = await saveFood(db, {
      date: todayISO(),
      dishName: "パスタ",
      genre: "italian",
      restaurantName: "ソーレ",
      notes: "NOTE_PRIVATE",
      companion: "WHO_PRIVATE",
      location: "WHERE_PRIVATE",
      highlights: "HL_PRIVATE",
      wantAgain: true
    });
    const { user } = await setup();
    await go(`#/share?kind=food&ids=${f.id}`);
    await user.click(await screen.findByRole("button", { name: "下書きを作る" }));
    const text = (screen.getByLabelText("送る文章") as HTMLTextAreaElement).value;
    expect(text).toBe("この前食べたソーレのパスタがすごく美味しかった。また一緒に行きたい！");
  });

  it("今日の気持ち:Wellness の数値は入らない", async () => {
    const { user } = await setup();
    await go("#/share?kind=feeling");
    await user.click(await screen.findByRole("checkbox", { name: "少し疲れています" }));
    await user.click(screen.getByRole("button", { name: "下書きを作る" }));
    expect(screen.getByLabelText("送る文章")).toHaveValue("少し疲れています");
  });
});

describe("Thanks の記録", () => {
  it("テンプレートから記録し、一覧に表示される", async () => {
    const { user, db } = await setup();
    await go(`#/thanks/new?template=${encodeURIComponent("支えてくれてありがとう")}`);
    expect(await screen.findByLabelText("何に感謝しているか")).toHaveValue("支えてくれてありがとう");
    await user.type(screen.getByLabelText(/伝えたいメッセージ/), "いつも支えてくれてありがとう");
    await user.click(screen.getByRole("button", { name: "保存する" }));
    expect(await screen.findByText("「いつも支えてくれてありがとう」")).toBeInTheDocument();
    expect(await db.gratitude.count()).toBe(1);
  });

  it("必須項目が空なら保存しない", async () => {
    const { user, db } = await setup();
    await go("#/thanks/new");
    await user.click(await screen.findByRole("button", { name: "保存する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("感謝していること");
    expect(await db.gratitude.count()).toBe(0);
  });
});

describe("設定", () => {
  it("全データ削除は「削除」と入力するまで実行できない", async () => {
    const db = getDb("real");
    await saveGratitude(db, { date: todayISO(), reason: "a" });
    const { user } = await setup();
    await go("#/settings");
    await user.click(await screen.findByRole("button", { name: "すべての記録を削除" }));
    const dialog = screen.getByRole("dialog");
    const del = within(dialog).getByRole("button", { name: "完全に削除する" });
    expect(del).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/「削除」と入力/), "削除");
    await user.click(del);
    expect(await screen.findByRole("button", { name: "はじめる" })).toBeInTheDocument();
    expect(await getDb("real").gratitude.count()).toBe(0);
  });

  it("デモモードに入ると実データは表示されず、出ると戻る", async () => {
    const db = getDb("real");
    await saveGratitude(db, { date: todayISO(), reason: "REAL_THANKS" });
    const { user } = await setup();
    await go("#/thanks");
    expect(await screen.findByText("REAL_THANKS")).toBeInTheDocument();
    await go("#/settings");
    await user.click(await screen.findByRole("button", { name: "デモモードを始める" }));
    expect(await screen.findByRole("link", { name: "デモモード" })).toBeInTheDocument();
    await go("#/thanks");
    expect(await screen.findByText("誕生日を覚えていてくれた")).toBeInTheDocument();
    expect(screen.queryByText("REAL_THANKS")).toBeNull();
    await go("#/settings");
    await user.click(await screen.findByRole("button", { name: "デモを終了して実データに戻る" }));
    await go("#/thanks");
    expect(await screen.findByText("REAL_THANKS")).toBeInTheDocument();
    expect(screen.queryByText("誕生日を覚えていてくれた")).toBeNull();
    expect(await db.gratitude.count()).toBe(1);
  });
});
