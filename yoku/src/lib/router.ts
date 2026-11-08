import { useSyncExternalStore } from "react";

/** ハッシュ方式の小さなルーター(静的ホスティングのサブディレクトリでもそのまま動く) */
export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathPart = "/", queryPart = ""] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return { path, segments: path.split("/").filter(Boolean), query: new URLSearchParams(queryPart) };
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  return parse(hash);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (opts.replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = target;
  }
}

export function goBack(fallback: string) {
  if (window.history.length > 1 && document.referrer !== "about:blank") window.history.back();
  else navigate(fallback, { replace: true });
}

export const href = (path: string) => `#${path}`;
