import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { DATA_TABLES, destroyDb, getDb } from "../../db/db";
import { countAll, saveBoundary, saveMemory, savePreference, saveSettings } from "../../db/repo";
import { REQUEST_CLOSING, REQUEST_NOTICE } from "../../lib/request";

const writeText = vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined);

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

async function setup(share?: (d: ShareData) => Promise<void>) {
  const db = getDb("real");
  await saveSettings(db, { adultConfirmed: true });
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  render(<App initialMode="real" />);
  return { db, user };
}

/** 秘密の文字列を、共有文に入ってはいけない欄にばらまいた記録を作る */
async function seed() {
  const db = getDb("real");
  const target = await savePreference(db, {
    title: "ゆっくりマッサージ",
    category: "play",
    status: "like",
    tags: ["TAG_SECRET"],
    notes: "NOTE_SECRET"
  });
  const other = await savePreference(db, { title: "OTHER_PREF_SECRET", category: "play", status: "like" });
  const notNow = await savePreference(db, { title: "今はいいこと", category: "play", status: "not_now" });
  const memory = await saveMemory(db, {
    title: "雨の日曜日",
    positiveExperience: "POSITIVE_SECRET",
    feelings: "FEELINGS_SECRET",
    wouldLikeAgain: "AGAIN_SECRET",
    notes: "MEMO_SECRET"
  });
  await saveBoundary(db, { title: "BOUNDARY_SECRET", status: "no" });
  return { target, other, notNow, memory };
}

const SECRETS = [
  "TAG_SECRET",
  "NOTE_SECRET",
  "OTHER_PREF_SECRET",
  "今はいいこと",
  "POSITIVE_SECRET",
  "FEELINGS_SECRET",
  "AGAIN_SECRET",
  "MEMO_SECRET",
  "BOUNDARY_SECRET"
];

beforeEach(async () => {
  await destroyDb("real");
  await destroyDb("demo");
  localStorage.clear();
  window.location.hash = "";
  writeText.mockClear();
});

describe("もう一度お願いしたい", () => {
  it("好きなプレイの詳細 → もう一度お願いしたい → テンプレート切替 → 編集 → プレビュー → コピー。他の記録は混ざらず、元の記録は変わらない", async () => {
    const { target } = await seed();
    const { user, db } = await setup();
    const before = await countAll(db);
    const beforeTarget = await db.intimacyPreferences.get(target.id);

    await go(`#/intimacy/preference/${target.id}`);
    // 詳細画面の3つの導線
    expect(await screen.findByRole("heading", { name: "ゆっくりマッサージ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "好みを編集" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "共有メッセージを作成" })).toHaveAttribute("href", `#/share?kind=intimacy&ids=p:${target.id}`);
    expect(screen.getByText(REQUEST_NOTICE)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "もう一度お願いしたい" }));

    expect(await screen.findByRole("heading", { name: "もう一度お願いしたい" })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/intimacy/request?preference=${target.id}`);
    const box = screen.getByLabelText("送る文章");
    expect(box).toHaveValue(`この前のゆっくりマッサージ、すごく嬉しかった。また一緒にできたらいいな♡\n${REQUEST_CLOSING}`);

    // テンプレートの切り替え
    await user.click(screen.getByRole("radio", { name: "少し照れながら" }));
    expect(box).toHaveValue(`直接言うのはちょっと恥ずかしいけど、ゆっくりマッサージをまたお願いしたいな。\n${REQUEST_CLOSING}`);
    await user.click(screen.getByRole("radio", { name: "相談したい" }));
    expect(box).toHaveValue(`ゆっくりマッサージが好きだったから、またできたら嬉しい。どう思う？\n${REQUEST_CLOSING}`);
    await user.click(screen.getByRole("radio", { name: "シンプルに" }));
    expect(box).toHaveValue(`ゆっくりマッサージ、またしてみたいな♡\n${REQUEST_CLOSING}`);
    // 結びを外す
    await user.click(screen.getByLabelText("返事をしやすい一文を添える"));
    expect(box).toHaveValue("ゆっくりマッサージ、またしてみたいな♡");
    // 文章の編集
    await user.clear(box);
    await user.type(box, "ゆっくりマッサージ、また今度ね");

    await user.click(screen.getByRole("button", { name: "確認へ進む" }));
    expect(screen.getByTestId("request-title")).toHaveTextContent("ゆっくりマッサージ");
    expect(screen.getByTestId("share-preview")).toHaveTextContent("ゆっくりマッサージ、また今度ね");
    expect(screen.getByText(/送る相手とアプリは、このあと自分で選びます/)).toBeInTheDocument();
    expect(screen.getByText(/相手の端末やアプリに残る可能性があります/)).toBeInTheDocument();
    expect(screen.getByText(/相手には断る自由があり/)).toBeInTheDocument();

    // 確認するまで送れない(初期状態はオフ)
    const copy = screen.getByRole("button", { name: "文章をコピー" });
    expect(copy).toBeDisabled();
    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText("内容と送り先を確認しました"));
    await user.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    const sent = writeText.mock.calls[0]![0];
    expect(sent).toBe("ゆっくりマッサージ、また今度ね");
    expect(await screen.findByText(/文章をコピーしました/)).toBeInTheDocument();

    // 下書き・共有の記録は保存されず、元の記録は変わらない
    expect(await countAll(db)).toEqual(before);
    expect(await db.intimacyPreferences.get(target.id)).toEqual(beforeTarget);
    expect(db.tables.map((t) => t.name).sort()).toEqual([...DATA_TABLES, "meta", "settings"].sort());
  });

  it("どのテンプレートでも、メモ・タグ・ほかの Intimacy の記録が下書きに入らない", async () => {
    const { target } = await seed();
    const { user } = await setup();
    await go(`#/intimacy/request?preference=${target.id}`);
    const box = await screen.findByLabelText("送る文章");
    for (const tone of ["やさしく伝える", "少し照れながら", "相談したい", "シンプルに"]) {
      await user.click(screen.getByRole("radio", { name: tone }));
      const text = (box as HTMLTextAreaElement).value;
      expect(text).toContain("ゆっくりマッサージ");
      for (const s of SECRETS) expect(text).not.toContain(s);
    }
  });

  it("良かった体験の詳細から作れる。体験の詳細(心地よかったこと等)は入らない", async () => {
    const { memory } = await seed();
    const { user } = await setup();
    await go(`#/intimacy/memory/${memory.id}`);
    expect(await screen.findByRole("heading", { name: "雨の日曜日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "記録を編集" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "もう一度お願いしたい" }));
    const box = await screen.findByLabelText("送る文章");
    const text = (box as HTMLTextAreaElement).value;
    expect(text).toContain("この前の雨の日曜日、すごく嬉しかった");
    for (const s of SECRETS) expect(text).not.toContain(s);
    // 呼び方は本人が書き直せる
    const name = screen.getByLabelText("伝えるときの呼び方");
    await user.clear(name);
    await user.type(name, "ゆっくりした時間");
    expect((box as HTMLTextAreaElement).value).toContain("この前のゆっくりした時間、");
  });

  it("共有シートでキャンセルしても何も送られず、確認画面にとどまる", async () => {
    const { target } = await seed();
    const share = vi.fn<(d: ShareData) => Promise<void>>().mockRejectedValue(new DOMException("cancel", "AbortError"));
    const { user, db } = await setup(share);
    const before = await countAll(db);
    await go(`#/intimacy/request?preference=${target.id}`);
    await user.click(await screen.findByRole("button", { name: "確認へ進む" }));
    const shareBtn = screen.getByRole("button", { name: "共有する" });
    expect(shareBtn).toBeDisabled();
    await user.click(screen.getByLabelText("内容と送り先を確認しました"));
    await user.click(shareBtn);
    expect(share).toHaveBeenCalledTimes(1);
    // 共有シートには文章だけを渡す(URL・タイトル・ファイルなし)
    expect(Object.keys(share.mock.calls[0]![0])).toEqual(["text"]);
    expect(await screen.findByText("共有をキャンセルしました。何も送られていません")).toBeInTheDocument();
    expect(screen.getByTestId("share-preview")).toBeInTheDocument();
    expect(await countAll(db)).toEqual(before);
  });

  it("「送らずにやめる」で詳細に戻り、記録はそのまま", async () => {
    const { target } = await seed();
    const { user, db } = await setup();
    await go(`#/intimacy/request?preference=${target.id}`);
    await user.click(await screen.findByRole("button", { name: "確認へ進む" }));
    await user.click(screen.getByRole("button", { name: "送らずにやめる" }));
    expect(await screen.findByRole("heading", { name: "ゆっくりマッサージ" })).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect((await db.intimacyPreferences.get(target.id))?.status).toBe("like");
  });

  it("今の気持ちが「今は希望しない」の好みには出さず、URL を直接開いても文章を作らない", async () => {
    const { notNow } = await seed();
    await setup();
    await go(`#/intimacy/preference/${notNow.id}`);
    expect(await screen.findByRole("heading", { name: "今はいいこと" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "もう一度お願いしたい" })).toBeNull();
    expect(screen.getByText(/「もう一度お願いしたい」は表示していません/)).toBeInTheDocument();
    await go(`#/intimacy/request?preference=${notNow.id}`);
    expect(await screen.findByText(/以前の気持ちをもとに、お願いの文章は作りません/)).toBeInTheDocument();
    expect(screen.queryByLabelText("送る文章")).toBeNull();
  });

  it("相手の反応・同意を判定したり記録したりする UI がない", async () => {
    const { target } = await seed();
    const { user } = await setup();
    await go(`#/intimacy/request?preference=${target.id}`);
    await user.click(await screen.findByRole("button", { name: "確認へ進む" }));
    await user.click(screen.getByLabelText("内容と送り先を確認しました"));
    await user.click(screen.getByRole("button", { name: "文章をコピー" }));
    await screen.findByText(/文章をコピーしました/);
    for (const t of ["いいね、話してみたい", "もう少し相談したい", "同意", "既読", "返事を待つ", "再送"]) {
      expect(screen.queryByRole("button", { name: new RegExp(t) })).toBeNull();
    }
    expect(screen.queryByText(/同意しました|同意が成立|承諾/)).toBeNull();
    expect(screen.getByText(/返事を待ったり、催促したりする必要はありません/)).toBeInTheDocument();
  });

  it("「好みを編集」で既存のフォームに切り替わり、保存できる", async () => {
    const { target } = await seed();
    const { user, db } = await setup();
    await go(`#/intimacy/preference/${target.id}`);
    await user.click(await screen.findByRole("button", { name: "好みを編集" }));
    const status = screen.getByRole("group", { name: "今の気持ち" });
    await user.click(within(status).getByRole("radio", { name: "相談してみたい" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(async () => expect((await db.intimacyPreferences.get(target.id))?.status).toBe("discuss"));
  });
});
