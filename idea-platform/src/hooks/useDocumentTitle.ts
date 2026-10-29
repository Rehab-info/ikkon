import { useEffect } from 'react'
import { BRAND } from '../config/brand'

/** 画面タイトルを設定する */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND.name}` : `${BRAND.name} — ${BRAND.shortTagline}`
  }, [title])
}
