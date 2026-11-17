import { ButtonLink } from '../components/ui/Button'
import { Container } from '../components/ui/PageHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('ページが見つかりません')
  return (
    <Container className="max-w-xl py-24 text-center">
      <p className="text-xs tracking-[0.2em] text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold">ページが見つかりません</h1>
      <p className="mt-3 text-muted">URLが正しいかご確認ください。</p>
      <div className="mt-8 flex justify-center gap-2">
        <ButtonLink to="/">トップへ</ButtonLink>
        <ButtonLink to="/ideas" variant="secondary">
          アイデアを探す
        </ButtonLink>
      </div>
    </Container>
  )
}
