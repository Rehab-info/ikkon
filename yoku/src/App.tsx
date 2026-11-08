import { useEffect, useState } from "react";
import { Home as HomeIcon, Settings as SettingsIcon } from "lucide-react";
import { AppProvider, useApp } from "./state/AppContext";
import { ToastProvider, cx } from "./components/ui";
import { DOMAINS } from "./components/domains";
import { Wordmark } from "./components/Logo";
import { href, navigate, useRoute, type Route } from "./lib/router";
import { HomePage } from "./features/home/HomePage";
import { WellnessPage } from "./features/wellness/WellnessPage";
import { WellnessEditPage } from "./features/wellness/WellnessEditPage";
import { IntimacyPage } from "./features/intimacy/IntimacyPage";
import { PreferenceEditPage } from "./features/intimacy/PreferenceEditPage";
import { MemoryEditPage } from "./features/intimacy/MemoryEditPage";
import { BoundaryEditPage } from "./features/intimacy/BoundaryEditPage";
import { RequestPage } from "./features/intimacy/RequestPage";
import { FoodPage } from "./features/food/FoodPage";
import { FoodEditPage } from "./features/food/FoodEditPage";
import { ThanksPage } from "./features/thanks/ThanksPage";
import { ThanksEditPage } from "./features/thanks/ThanksEditPage";
import { TogetherPage } from "./features/together/TogetherPage";
import { SharePage } from "./features/share/SharePage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { PrivacyPage } from "./features/settings/PrivacyPage";
import { Welcome } from "./features/onboarding/Welcome";
import type { DataMode } from "./db/types";
import { IS_PREVIEW } from "./lib/env";

function useTheme() {
  const { settings } = useApp();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      // 表示先が data-theme でテーマを指定していれば、「端末に合わせる」のときはそれに従う
      const hostTheme = root.getAttribute("data-theme");
      const systemDark = hostTheme === "dark" ? true : hostTheme === "light" ? false : !!mq?.matches;
      const dark = settings.theme === "dark" || (settings.theme === "system" && systemDark);
      root.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121816" : "#FAF9F6");
    };
    apply();
    mq?.addEventListener?.("change", apply);
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq?.removeEventListener?.("change", apply);
      obs.disconnect();
    };
  }, [settings.theme]);
}

/** アプリが背面に回ったら画面を覆い、アプリ切替画面のサムネイルに内容を残さない */
function PrivacyCurtain() {
  const { settings } = useApp();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!settings.privacyScreen) return;
    const onVis = () => setHidden(document.visibilityState === "hidden");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onBlur);
    window.addEventListener("pageshow", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onBlur);
      window.removeEventListener("pageshow", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [settings.privacyScreen]);
  if (!settings.privacyScreen || !hidden) return null;
  return (
    <div data-testid="privacy-curtain" className="fixed inset-0 z-[100] flex items-center justify-center bg-bg" aria-hidden>
      <Wordmark />
    </div>
  );
}

const NAV = [
  { path: "/", label: "ホーム", Icon: HomeIcon, match: (p: string) => p === "/" },
  { path: DOMAINS.wellness.path, label: "Wellness", Icon: DOMAINS.wellness.Icon, match: (p: string) => p.startsWith("/wellness") },
  { path: DOMAINS.food.path, label: "Food", Icon: DOMAINS.food.Icon, match: (p: string) => p.startsWith("/food") },
  { path: DOMAINS.thanks.path, label: "Thanks", Icon: DOMAINS.thanks.Icon, match: (p: string) => p.startsWith("/thanks") },
  {
    path: DOMAINS.together.path,
    label: "Together",
    Icon: DOMAINS.together.Icon,
    match: (p: string) => p.startsWith("/together") || p.startsWith("/share")
  }
] as const;

/**
 * 下のナビには Intimacy を置かない(画面をのぞかれたときに目立たないように)。
 * Intimacy はホームと Together から開く。
 */
function BottomNav({ path }: { path: string }) {
  return (
    <nav aria-label="メイン" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-between px-2 pt-1.5">
        {NAV.map(({ path: p, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={p} className="flex-1">
              <a
                href={href(p)}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.68rem] font-medium tracking-wide",
                  active ? "text-primary" : "text-muted hover:text-ink"
                )}
              >
                <Icon aria-hidden size={22} strokeWidth={active ? 2.2 : 1.7} />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TopBar() {
  const { mode } = useApp();
  return (
    <div className="safe-top sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
        <a href={href("/")} aria-label="YOKU ホーム" className="rounded-lg">
          <Wordmark />
        </a>
        <div className="flex items-center gap-1">
          {mode === "demo" && (
            <a href={href("/settings")} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">
              デモモード
            </a>
          )}
          <a
            href={href("/settings")}
            aria-label="設定"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <SettingsIcon aria-hidden size={22} strokeWidth={1.7} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Routes({ route }: { route: Route }) {
  const { settings } = useApp();
  const [a, b, c] = route.segments;
  const intimacyHidden = !settings.showIntimacy;

  useEffect(() => {
    // Intimacy を非表示にしているときは、URL を直接開いても表示しない(データは消さない)
    if (intimacyHidden && (a === "intimacy" || (a === "share" && route.query.get("kind") === "intimacy")))
      navigate("/", { replace: true });
  }, [intimacyHidden, a, route.query]);

  switch (a) {
    case undefined:
      return <HomePage />;
    case "wellness":
      return b === "edit" ? <WellnessEditPage date={route.query.get("date")} /> : <WellnessPage />;
    case "intimacy":
      if (intimacyHidden) return null;
      if (b === "preference") return <PreferenceEditPage id={c === "new" ? undefined : c} category={route.query.get("category")} />;
      if (b === "memory") return <MemoryEditPage id={c === "new" ? undefined : c} />;
      if (b === "boundary") return <BoundaryEditPage id={c === "new" ? undefined : c} />;
      if (b === "request") return <RequestPage query={route.query} />;
      return <IntimacyPage tab={route.query.get("tab")} />;
    case "food":
      return b ? <FoodEditPage id={b === "new" ? undefined : b} /> : <FoodPage />;
    case "thanks":
      return b ? <ThanksEditPage id={b === "new" ? undefined : b} template={route.query.get("template")} /> : <ThanksPage />;
    case "together":
      return <TogetherPage />;
    case "share":
      return <SharePage query={route.query} />;
    case "settings":
      return <SettingsPage />;
    case "privacy":
      return <PrivacyPage />;
    default:
      return <HomePage />;
  }
}

function Shell() {
  const { ready, settings, mode } = useApp();
  const route = useRoute();
  useTheme();
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="読みこみ中">
        <Wordmark />
      </div>
    );
  }
  if (!settings.adultConfirmed && mode === "real" && route.path !== "/privacy") {
    return (
      <>
        <Welcome />
        <PrivacyCurtain />
      </>
    );
  }
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 rounded-full bg-primary px-4 py-2 text-on-primary" onClick={(e) => {
        e.preventDefault();
        document.getElementById("main")?.focus();
      }}>
        本文へ移動
      </a>
      <TopBar />
      {IS_PREVIEW && (
        <p className="mx-auto max-w-xl px-4 pt-3 text-xs leading-relaxed text-muted">
          仮公開のプレビュー版です。記録はこのブラウザーの中だけに保存され、ブラウザーの設定などで消えることがあります。オフライン・共有シート・書き出しは使えません(共有はコピーで行えます)。
        </p>
      )}
      <main id="main" tabIndex={-1} className="outline-none">
        <Routes route={route} />
      </main>
      <BottomNav path={route.path} />
      <PrivacyCurtain />
    </div>
  );
}

export default function App({ initialMode }: { initialMode?: DataMode }) {
  return (
    <AppProvider initialMode={initialMode}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  );
}
