// Sub-Cut: よく使われるサブスクの辞書。
// match は利用明細の「利用店名」に対する正規表現(NFKC で半角・大文字にそろえたあとの文字列に当てる)。
// url は解約・プラン変更の画面。深いリンクが変わりやすいサービスは公式サイトの入口にして、steps で道順を書く。
// 新しいサービスを足すときは、ここに1件足すだけで検知と解約ナビに反映される。
(function (root) {
  const SERVICES = [
    // --- AI・仕事道具 ---
    { id: "chatgpt", name: "ChatGPT", cat: "AI", match: /OPENAI|CHATGPT/, cycle: "monthly",
      url: "https://chatgpt.com/", steps: ["左下のアカウント名 → 設定", "「アカウント」→ サブスクリプションを管理", "「サブスクリプションをキャンセルする」"],
      note: "iPhone アプリから入った場合は Apple 側で解約します。" },
    { id: "claude", name: "Claude", cat: "AI", match: /ANTHROPIC|CLAUDE\.AI|CLAUDE AI/, cycle: "monthly",
      url: "https://claude.ai/settings/billing", steps: ["設定 → 請求(Billing)", "「キャンセル」を選ぶ"] },
    { id: "gemini", name: "Google One / Gemini", cat: "AI", match: /GOOGLE ?\*? ?(ONE|GEMINI|STORAGE)/, cycle: "monthly",
      url: "https://one.google.com/settings", steps: ["Google One の設定を開く", "「メンバーシップを解約」"] },
    { id: "perplexity", name: "Perplexity", cat: "AI", match: /PERPLEXITY/, cycle: "monthly",
      url: "https://www.perplexity.ai/settings/account", steps: ["設定 → アカウント", "サブスクリプションの管理 → キャンセル"] },
    { id: "midjourney", name: "Midjourney", cat: "AI", match: /MIDJOURNEY/, cycle: "monthly",
      url: "https://www.midjourney.com/account", steps: ["Manage Subscription を開く", "Cancel Plan"] },
    { id: "cursor", name: "Cursor", cat: "AI", match: /CURSOR|ANYSPHERE/, cycle: "monthly",
      url: "https://cursor.com/settings", steps: ["Settings → Billing", "Manage → Cancel"] },
    { id: "github", name: "GitHub", cat: "仕事道具", match: /GITHUB/, cycle: "monthly",
      url: "https://github.com/settings/billing", steps: ["Settings → Billing and plans", "有料プラン・Copilot をダウングレード"] },
    { id: "notion", name: "Notion", cat: "仕事道具", match: /NOTION/, cycle: "monthly",
      url: "https://www.notion.so/", steps: ["設定 → ワークスペース → プラン(請求)", "「プランを変更」→ フリーにダウングレード"] },
    { id: "canva", name: "Canva", cat: "仕事道具", match: /CANVA/, cycle: "yearly",
      url: "https://www.canva.com/", steps: ["アカウント設定 → 請求とプラン", "「サブスクリプションをキャンセル」"] },
    { id: "adobe", name: "Adobe", cat: "仕事道具", match: /ADOBE/, cycle: "monthly",
      url: "https://account.adobe.com/plans", steps: ["プランを管理 → プランを解約", "理由を選んで手続きを進める"],
      note: "年間プラン(月々払い)を途中で解約すると、解約手数料がかかることがあります。更新月を確かめてから解約しましょう。" },
    { id: "m365", name: "Microsoft 365", cat: "仕事道具", match: /MICROSOFT|MSFT|OFFICE ?365/, cycle: "yearly",
      url: "https://account.microsoft.com/services", steps: ["サービスとサブスクリプション", "「管理」→ サブスクリプションを取り消す"] },
    { id: "dropbox", name: "Dropbox", cat: "仕事道具", match: /DROPBOX/, cycle: "monthly",
      url: "https://www.dropbox.com/account/plan", steps: ["アカウント → プラン", "「プランをキャンセル」"] },
    { id: "zoom", name: "Zoom", cat: "仕事道具", match: /ZOOM\.US|ZOOM VIDEO|\bZOOM\b/, cycle: "monthly",
      url: "https://zoom.us/billing", steps: ["請求 → 現在のプラン", "「サブスクリプションをキャンセル」"] },
    { id: "deepl", name: "DeepL", cat: "仕事道具", match: /DEEPL/, cycle: "monthly",
      url: "https://www.deepl.com/account", steps: ["アカウント → プラン", "「契約を解除」"] },
    { id: "grammarly", name: "Grammarly", cat: "仕事道具", match: /GRAMMARLY/, cycle: "monthly",
      url: "https://account.grammarly.com/subscription", steps: ["Subscription", "Cancel subscription"] },
    // --- 動画・音楽・読書 ---
    { id: "netflix", name: "Netflix", cat: "動画", match: /NETFLIX/, cycle: "monthly",
      url: "https://www.netflix.com/cancelplan", steps: ["「メンバーシップのキャンセル」を押す", "完了画面が出るまで進める"] },
    { id: "youtube", name: "YouTube Premium", cat: "動画", match: /YOUTUBE/, cycle: "monthly",
      url: "https://www.youtube.com/paid_memberships", steps: ["購入とメンバーシップ", "「メンバーシップを管理」→ 解約"] },
    { id: "prime", name: "Amazon プライム", cat: "動画", match: /AMAZON ?PRIME|プライム|PRIME ?VIDEO|AMZN ?PRIME/, cycle: "monthly",
      url: "https://www.amazon.co.jp/gp/primecentral", steps: ["プライム会員情報", "「プライム会員資格を終了する」"] },
    { id: "kindle", name: "Kindle Unlimited", cat: "読書", match: /KINDLE ?UNLIMITED|KINDLE ?SVCS/, cycle: "monthly",
      url: "https://www.amazon.co.jp/kindle-dbs/ku/ku-central", steps: ["Kindle Unlimited 会員登録の管理", "「メンバーシップを解約」"] },
    { id: "audible", name: "Audible", cat: "読書", match: /AUDIBLE/, cycle: "monthly",
      url: "https://www.audible.co.jp/account", steps: ["アカウントサービス", "「退会手続きへ」"] },
    { id: "disney", name: "Disney+", cat: "動画", match: /DISNEY/, cycle: "monthly",
      url: "https://www.disneyplus.com/", steps: ["プロフィール → アカウント", "サブスクリプション → 「サブスクリプションを解約」"],
      note: "ドコモ経由で入った場合は、ドコモのお手続きで解約します。" },
    { id: "unext", name: "U-NEXT", cat: "動画", match: /U-?NEXT|ユーネクスト/, cycle: "monthly",
      url: "https://video.unext.jp/", steps: ["アカウント・契約", "契約・解約 → 「解約はこちら」"] },
    { id: "hulu", name: "Hulu", cat: "動画", match: /HULU/, cycle: "monthly",
      url: "https://www.hulu.jp/account", steps: ["アカウント → 契約内容", "「契約を解除する」"] },
    { id: "dazn", name: "DAZN", cat: "動画", match: /DAZN/, cycle: "monthly",
      url: "https://www.dazn.com/ja-JP/myaccount", steps: ["マイ・アカウント", "「退会する」"] },
    { id: "abema", name: "ABEMA", cat: "動画", match: /ABEMA/, cycle: "monthly",
      url: "https://abema.tv/", steps: ["マイページ → 視聴プラン", "「解約する」"] },
    { id: "spotify", name: "Spotify", cat: "音楽", match: /SPOTIFY/, cycle: "monthly",
      url: "https://www.spotify.com/account/subscription/", steps: ["プランを管理", "「プレミアムを解約」"] },
    // --- 窓口がまとめて請求するもの ---
    { id: "apple", name: "Apple(App Store 経由)", cat: "まとめ請求", match: /APPLE\.COM|APPLE COM|ITUNES/, cycle: "monthly",
      url: "https://apps.apple.com/account/subscriptions", steps: ["iPhone の 設定 → 自分の名前 → サブスクリプション", "解約したいものを選んで「サブスクリプションをキャンセル」"],
      note: "明細には「APPLE.COM/BILL」とだけ出ます。iCloud・Apple Music のほか、iPhone アプリから入ったサブスクもここにまとまっています。" },
    { id: "googleplay", name: "Google Play 経由", cat: "まとめ請求", match: /GOOGLE ?\*? ?PLAY|GOOGLE ?PLAY/, cycle: "monthly",
      url: "https://play.google.com/store/account/subscriptions", steps: ["Google Play → 定期購入", "解約したいものを選んで「定期購入を解約」"],
      note: "Android アプリから入ったサブスクは、ここにまとまっています。" },
    // --- ゲーム ---
    { id: "psplus", name: "PlayStation Plus", cat: "ゲーム", match: /PLAYSTATION|SONY ?NETWORK|\bPSN\b/, cycle: "monthly",
      url: "https://www.playstation.com/ja-jp/", steps: ["アカウント管理 → サブスクリプション管理", "「自動更新をオフにする」"] },
    { id: "nintendo", name: "Nintendo Switch Online", cat: "ゲーム", match: /NINTENDO/, cycle: "yearly",
      url: "https://accounts.nintendo.com/", steps: ["ニンテンドーeショップ → アカウント情報", "「自動継続購入を停止する」"] }
  ];

  // サブスクではないが毎月引き落とされるもの(固定費)。初期状態は「使っている」にする
  const FIXED = /電気|電力|でんき|ガス|水道|NTT|ドコモ|DOCOMO|AU ?KDDI|KDDI|ソフトバンク|SOFTBANK|楽天モバイル|RAKUTEN ?MOBILE|AHAMO|POVO|LINEMO|保険|家賃|管理費|NHK|放送受信/;

  root.SubCutServices = { SERVICES, FIXED };
  if (typeof module !== "undefined") module.exports = root.SubCutServices;
})(typeof window !== "undefined" ? window : globalThis);
