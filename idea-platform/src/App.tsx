import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Button } from './components/ui/Button'
import { ErrorState, Loading } from './components/ui/States'
import { DemoUserProvider } from './context/DemoUserProvider'
import { ToastProvider } from './context/ToastProvider'
import { ensureSeeded } from './db/seed'
import HomePage from './pages/HomePage'

// トップ以外の画面は必要になった時に読み込む（知識マップ等の大きな依存を分離）
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))
const IdeasPage = lazy(() => import('./pages/IdeasPage'))
const IdeaDetailPage = lazy(() => import('./pages/IdeaDetailPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const CreatorPage = lazy(() => import('./pages/CreatorPage'))
const ConnectPage = lazy(() => import('./pages/ConnectPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NoticePage = lazy(() => import('./pages/NoticePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const IipPage = lazy(() => import('./pages/IipPage'))

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string }

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' })

  useEffect(() => {
    ensureSeeded()
      .then(() => setBoot({ status: 'ready' }))
      .catch((e: unknown) =>
        setBoot({
          status: 'error',
          message:
            'ブラウザの保存領域（IndexedDB）を利用できませんでした。プライベートブラウズを解除するか、別のブラウザでお試しください。\n' +
            (e instanceof Error ? e.message : ''),
        }),
      )
  }, [])

  if (boot.status === 'loading') return <Loading label="デモデータを準備しています…" />
  if (boot.status === 'error') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <ErrorState title="データを読み込めませんでした" message={boot.message} action={<Button onClick={() => location.reload()}>再読み込み</Button>} />
      </div>
    )
  }

  return (
    <ToastProvider>
      <DemoUserProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="ideas" element={<IdeasPage />} />
                <Route path="ideas/:id" element={<IdeaDetailPage />} />
                <Route path="checkout/:id" element={<CheckoutPage />} />
                <Route path="creators/:id" element={<CreatorPage />} />
                <Route path="connect/:creatorId" element={<ConnectPage />} />
                <Route path="workspace" element={<WorkspacePage />} />
                <Route path="workspace/iip/:id" element={<IipPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="notice" element={<NoticePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DemoUserProvider>
    </ToastProvider>
  )
}
