import { ArrowLeft, CircleCheck, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { SelectField, TextAreaField } from '../components/ui/Field'
import { Notice } from '../components/ui/Notice'
import { Container } from '../components/ui/PageHeader'
import { ErrorState, Loading } from '../components/ui/States'
import { useDemoUser } from '../context/demoUser'
import { db } from '../db/database'
import { createConnectionRequest, DemoError } from '../db/repo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLiveData } from '../hooks/useLiveData'
import { CONNECTION_STATUS_META } from '../lib/labels'
import {
  COLLABORATION_FORMS,
  CONNECTION_PURPOSES,
  type CollaborationForm,
  type ConnectionPurpose,
} from '../types'

type Step = 'input' | 'confirm' | 'done'

interface FormState {
  ideaId: string
  purpose: ConnectionPurpose | ''
  message: string
  collaboration: CollaborationForm | ''
}

const MESSAGE_MIN = 20
const MESSAGE_MAX = 1000
/** 連絡先の直接記載を防ぐ（同意前の開示を避けるため） */
const CONTACT_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+|0\d{1,4}-?\d{1,4}-?\d{3,4}/

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {}
  if (!form.purpose) errors.purpose = '相談目的を選択してください。'
  if (!form.collaboration) errors.collaboration = '希望する協力形態を選択してください。'
  const len = form.message.trim().length
  if (len < MESSAGE_MIN) errors.message = `相談内容を${MESSAGE_MIN}文字以上で入力してください（現在${len}文字）。`
  else if (len > MESSAGE_MAX) errors.message = `相談内容は${MESSAGE_MAX}文字以内で入力してください。`
  else if (CONTACT_PATTERN.test(form.message)) errors.message = 'メールアドレスや電話番号は記載しないでください。連絡先は双方の同意後に扱います。'
  return errors
}

export default function ConnectPage() {
  useDocumentTitle('相談を申し込む')
  const { creatorId = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useDemoUser()
  const creatorQuery = useLiveData(() => db.creators.get(creatorId), [creatorId])
  const { data: ideas } = useLiveData(
    () => db.ideas.where('creatorId').equals(creatorId).filter((i) => i.status === 'published' || i.status === 'nondisclosure').toArray(),
    [creatorId],
  )
  const [step, setStep] = useState<Step>('input')
  const [form, setForm] = useState<FormState>({ ideaId: params.get('idea') ?? '', purpose: '', message: '', collaboration: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requestId, setRequestId] = useState('')
  const { data: sent } = useLiveData(() => (requestId ? db.connections.get(requestId) : Promise.resolve(undefined)), [requestId])

  if (creatorQuery.loading) return <Loading />
  const creator = creatorQuery.data
  if (!creator) {
    return (
      <Container className="py-20">
        <ErrorState title="創作者が見つかりません" action={<ButtonLink to="/ideas" variant="secondary">アイデア一覧へ</ButtonLink>} />
      </Container>
    )
  }

  const back = (
    <Link to={`/creators/${creator.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      {creator.displayName}さんのプロフィール
    </Link>
  )

  if (creator.consultation === 'closed') {
    return (
      <Container className="max-w-2xl py-14">
        {back}
        <div className="mt-8">
          <ErrorState title="現在、相談の受付を停止しています" message={creator.consultationNote} />
        </div>
      </Container>
    )
  }
  if (user.creatorId === creator.id) {
    return (
      <Container className="max-w-2xl py-14">
        {back}
        <div className="mt-8">
          <ErrorState title="ご自身には相談を申し込めません" message="デモ利用者を「購入者」に切り替えてお試しください。" />
        </div>
      </Container>
    )
  }

  const selectedIdea = ideas?.find((i) => i.id === form.ideaId)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const toConfirm = (e: FormEvent) => {
    e.preventDefault()
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length === 0) {
      setStep('confirm')
      window.scrollTo(0, 0)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const id = await createConnectionRequest({
        creatorId: creator.id,
        requesterId: user.id,
        ideaId: form.ideaId || undefined,
        purpose: form.purpose as ConnectionPurpose,
        message: form.message.trim(),
        collaboration: form.collaboration as CollaborationForm,
      })
      setRequestId(id)
      setStep('done')
      window.scrollTo(0, 0)
    } catch (err) {
      setSubmitError(err instanceof DemoError ? err.message : '申請の記録に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  const steps: Array<[Step, string]> = [
    ['input', '入力'],
    ['confirm', '確認'],
    ['done', '送信（デモ）'],
  ]

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      {back}
      <div className="mt-6 flex items-center gap-4">
        <Avatar creator={creator} />
        <div>
          <p className="text-sm text-muted">相談の申し込み先</p>
          <h1 className="text-xl font-semibold sm:text-2xl">{creator.displayName}さんに相談を申し込む</h1>
        </div>
      </div>

      <ol className="mt-8 flex gap-2 text-sm" aria-label="申請の手順">
        {steps.map(([key, label], i) => {
          const current = key === step
          const doneIdx = steps.findIndex(([k]) => k === step)
          return (
            <li key={key} className="flex flex-1 flex-col gap-2" aria-current={current ? 'step' : undefined}>
              <span className={`h-1 rounded-full ${i <= doneIdx ? 'bg-ink' : 'bg-line'}`} aria-hidden />
              <span className={current ? 'font-medium text-ink' : 'text-muted'}>
                {i + 1}. {label}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-6">
        <Notice tone="info" title="連絡先は同意前に開示されません">
          申請内容は創作者に届き、創作者が承諾した場合にのみ対話が始まります（双方同意）。このプロトタイプでは申請はブラウザ内にのみ記録され、外部には送信されません。
        </Notice>
      </div>

      {step === 'input' && (
        <form onSubmit={toConfirm} className="mt-8 space-y-6" noValidate>
          <SelectField label="対象アイデア" hint="特定のアイデアについての相談でない場合は「指定しない」を選んでください。" value={form.ideaId} onChange={(e) => set('ideaId', e.target.value)}>
            <option value="">指定しない</option>
            {(ideas ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </SelectField>

          <fieldset>
            <legend className="text-sm font-medium text-ink">
              相談目的<span className="ml-1.5 text-xs font-normal text-rust">必須</span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" aria-describedby={errors.purpose ? 'purpose-error' : undefined}>
              {CONNECTION_PURPOSES.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm ${form.purpose === p ? 'border-ink bg-paper' : 'border-line hover:border-ink/40'}`}
                >
                  <input type="radio" name="purpose" value={p} checked={form.purpose === p} onChange={() => set('purpose', p)} className="accent-ink" />
                  {p}
                </label>
              ))}
            </div>
            {errors.purpose && (
              <p id="purpose-error" className="mt-1.5 text-xs text-rust" role="alert">
                {errors.purpose}
              </p>
            )}
          </fieldset>

          <TextAreaField
            label="相談内容"
            required
            rows={7}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            error={errors.message}
            hint={`${MESSAGE_MIN}〜${MESSAGE_MAX}文字。連絡先（メールアドレス・電話番号）は記載しないでください。現在${form.message.trim().length}文字。`}
            placeholder="どのような背景で、何について話したいかをお書きください。"
            maxLength={MESSAGE_MAX + 200}
          />

          <SelectField label="希望する協力形態" required value={form.collaboration} onChange={(e) => set('collaboration', e.target.value as CollaborationForm)} error={errors.collaboration}>
            <option value="">選択してください</option>
            {COLLABORATION_FORMS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>

          <p className="text-xs leading-relaxed text-muted">
            アイデアを購入済みであっても、創作者の協働が保証されるものではありません。創作者には申請を見送る自由があります。
          </p>

          <div className="flex justify-end">
            <Button type="submit" size="lg">
              入力内容を確認する
            </Button>
          </div>
        </form>
      )}

      {step === 'confirm' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">申請内容の確認</h2>
          <dl className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
            {[
              ['申し込み先', `${creator.displayName}さん`],
              ['申請者（デモ）', user.displayName],
              ['対象アイデア', selectedIdea?.title ?? '指定しない'],
              ['相談目的', form.purpose],
              ['希望する協力形態', form.collaboration],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted">相談内容</dt>
              <dd className="whitespace-pre-wrap text-ink">{form.message.trim()}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            送信先：このブラウザ内のデモデータベース（IndexedDB）のみ。外部サーバー・メールへの送信は行いません。
          </p>
          {submitError && (
            <p className="mt-4 rounded-md bg-rust-soft px-3 py-2 text-sm text-rust" role="alert">
              {submitError}
            </p>
          )}
          <div className="mt-8 flex flex-col-reverse justify-between gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setStep('input')} disabled={submitting}>
              入力に戻る
            </Button>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? '送信しています…' : 'この内容で申請する（デモ送信）'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="mt-8 rounded-lg border border-line p-8 text-center" data-testid="connection-done">
          <CircleCheck className="mx-auto size-10 text-moss" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">相談申請を記録しました（デモ）</h2>
          <p className="mt-2 text-sm text-muted">実際の送信は行われていません。デモ利用者を「創作者」に切り替えると、受信した申請に返答できます。</p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm">
            <span className="text-muted">申請ステータス：</span>
            {sent && <Badge tone={CONNECTION_STATUS_META[sent.status].tone}>{CONNECTION_STATUS_META[sent.status].label}</Badge>}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink to="/account?tab=connections">相談申請履歴を見る</ButtonLink>
            <ButtonLink to="/ideas" variant="secondary">
              アイデア一覧へ
            </ButtonLink>
          </div>
        </div>
      )}
    </Container>
  )
}
