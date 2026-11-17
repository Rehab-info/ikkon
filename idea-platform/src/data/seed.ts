/* =========================================================
 * デモデータ
 * 登場する人物・組織・アイデアはすべて架空です。
 * 実在の個人情報・企業秘密・未公開の事業アイデアは含みません。
 * ========================================================= */
import type {
  ConnectionRequest,
  CreatorProfile,
  Idea,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeProject,
  NodeKind,
  EdgeRelation,
  PurchaseDemo,
  ReviewRecord,
  SampleMap,
  SourceReference,
  User,
} from '../types'

/** シード内容を変更したら上げる（既存ブラウザでの再シード判定に使用） */
export const SEED_VERSION = 1

/** 標準価格（デモ） */
export const STANDARD_PRICE = 30000

/** 初回非公開期間（か月） */
export const NONDISCLOSURE_MONTHS = 6

export const DEMO_USERS: User[] = [
  {
    id: 'u_buyer',
    displayName: '森下 遥（デモ購入者）',
    role: 'buyer',
    organization: '架空の株式会社サンプル 新規事業室',
    description: 'アイデアを探し、購入デモや相談申請を行う立場です。',
  },
  {
    id: 'u_creator',
    displayName: '朝倉 みなと（デモ創作者）',
    role: 'creator',
    creatorId: 'c_asakura',
    description: 'ワークスペースでアイデアを構造化し、出品する立場です。届いた相談に返答できます。',
  },
  {
    id: 'u_admin',
    displayName: '運営デモアカウント',
    role: 'admin',
    description: '出品審査や相談申請の状況を確認する立場です（本番の権限管理ではありません）。',
  },
]

export const DEMO_CREATORS: CreatorProfile[] = [
  {
    id: 'c_asakura',
    displayName: '朝倉 みなと',
    tagline: '暮らしの「小さな面倒」を、仕組みで静かに消していく人',
    avatarTone: 'navy',
    background:
      '家族の介護と仕事を両立する中で、連絡や記録の手間が想像以上に多いことに気づきました。困りごとをメモし続けるうちに、それぞれに共通する構造が見えてきたことが、アイデアづくりを始めたきっかけです。',
    interests: ['ケアと暮らし', '地域の支え合い', '情報の整理'],
    publicCareer: '会社員（事務職）として12年。業務手順の見直しを担当。',
    thinkingStyle: ['観察から始める', '手順に分解する', '当事者の言葉を残す'],
    philosophy:
      '良いアイデアは、困っている人の言葉の中にすでに半分あると考えています。私の役割は、その言葉を丁寧に拾い、誰でも使える形に組み直すことです。',
    consultation: 'open',
    consultationNote: '平日夜・週末のオンライン対話が中心です。',
    joinedAt: '2026-03-02T09:00:00.000Z',
  },
  {
    id: 'c_hoshino',
    displayName: '星野 律',
    tagline: '教室の外にある学びを、もう一度教室に戻したい学生',
    avatarTone: 'teal',
    background:
      '教育学部で学ぶ中で、授業の内容と地域で起きていることのつながりが見えにくいと感じてきました。アルバイト先の学習塾や地域ボランティアでの気づきを、アイデアとして形にしています。',
    interests: ['教育', '地域連携', '探究学習'],
    thinkingStyle: ['問いを立てる', '小さく試す', '仲間を巻き込む'],
    philosophy:
      '完璧な案より、試せる案を。小さく試した結果をもとに、問いそのものを磨き直すことを大切にしています。',
    consultation: 'open',
    consultationNote: '学業優先のため、返答に数日いただく場合があります。',
    joinedAt: '2026-04-18T09:00:00.000Z',
  },
  {
    id: 'c_kurata',
    displayName: '倉田 しおり',
    tagline: '数字の奥にある「なぜ」を追いかける研究者',
    avatarTone: 'plum',
    background:
      '環境データの解析を続ける中で、測定されたデータが現場の意思決定に十分使われていない場面を何度も見てきました。研究と現場の間にある溝を埋める仕組みを考えています。',
    interests: ['環境', '循環型社会', 'データ活用'],
    publicCareer: '大学の研究員として環境データ解析に従事（分野のみ公開）。',
    thinkingStyle: ['仮説を立てて反証を探す', '構造を図にする', '前提を疑う'],
    philosophy:
      '自分の仮説に一番厳しい反論者でいること。反証に耐えたアイデアだけが、人に手渡す価値を持つと考えています。',
    consultation: 'limited',
    consultationNote: '共同研究・共同開発のご相談を優先しています。',
    joinedAt: '2026-02-10T09:00:00.000Z',
  },
  {
    id: 'c_nishida',
    displayName: '西田 拓海',
    tagline: '一度失敗した事業から、次の問いを見つけた起業家',
    avatarTone: 'brass',
    background:
      '小さな飲食店の経営を経験し、仕入れと在庫の判断にかかる負担の大きさを身をもって知りました。その経験から、小規模事業者が使える「判断の道具」のアイデアを生み出しています。',
    interests: ['小規模事業', '食と流通', '業務設計'],
    publicCareer: '飲食店を3年間経営。現在は個人で事業構想の支援を行っています。',
    thinkingStyle: ['現場で確かめる', 'お金の流れから考える', '撤退条件を先に決める'],
    philosophy:
      'アイデアは「誰が、いくら払うか」まで考えて初めて形になる。ただし最初の一歩は、困っている人の隣で話を聞くことです。',
    consultation: 'open',
    joinedAt: '2026-05-07T09:00:00.000Z',
  },
  {
    id: 'c_mizuno',
    displayName: '水野 さとる',
    tagline: '台所と家計簿から社会を眺める、生活の発明家',
    avatarTone: 'moss',
    background:
      '専業主夫として家事と子育てを担う中で、家庭内の「名前のない仕事」の多さに気づきました。日々の工夫を記録し、他の家庭でも使える形に整えることが、アイデアづくりの原点です。',
    interests: ['生活', '家事の見える化', '子育て'],
    thinkingStyle: ['身近な不便を集める', '工夫を言語化する', '続けられる形にする'],
    philosophy:
      '特別な知識がなくても、毎日の暮らしの中で誰より長く考えてきたことがある。それ自体が価値になると信じています。',
    consultation: 'open',
    joinedAt: '2026-06-21T09:00:00.000Z',
  },
  {
    id: 'c_aoi',
    displayName: '葵 ことは',
    tagline: '地域の記憶を、次の世代の仕事に変える編集者',
    avatarTone: 'slate',
    background:
      '地元の商店街で育ち、閉じていく店の話を聞き書きしてきました。失われつつある技術や知恵を、新しい仕事や観光の資源として編み直すアイデアを考えています。',
    interests: ['地域', '文化継承', '観光'],
    publicCareer: 'フリーランスの編集・ライター。',
    thinkingStyle: ['聞き書きする', '物語として組み立てる', '関係者をつなぐ'],
    philosophy:
      'アイデアは一人のものではなく、その土地で暮らしてきた人たちの知恵の上に立っています。だからこそ、出典と敬意を大切にしています。',
    consultation: 'closed',
    consultationNote: '現在は既存の相談対応に集中しているため、新規受付を停止しています。',
    joinedAt: '2026-01-15T09:00:00.000Z',
  },
]

function map(
  nodes: Array<[string, NodeKind, string, number, number]>,
  edges: Array<[string, string, EdgeRelation]>,
): SampleMap {
  return {
    nodes: nodes.map(([id, kind, label, x, y]) => ({ id, kind, label, x, y })),
    edges: edges.map(([source, target, relation], i) => ({ id: `e${i}`, source, target, relation })),
  }
}

const COMMON_HIDDEN =
  '具体的な仕組みの設計、検証データの詳細、実行手順は購入後の納品物にのみ含まれます。'

export const DEMO_IDEAS: Idea[] = [
  {
    id: 'idea-care-log',
    creatorId: 'c_asakura',
    title: '家族介護の「申し送り」を一枚にまとめる共有ノート',
    catchcopy: '複数の家族とケア担当者の間で、伝え漏れを減らすための記録の型。',
    category: 'ヘルスケア',
    tags: ['介護', '家族', '情報共有'],
    summary:
      '在宅介護では、家族・訪問スタッフ・通所施設などが別々の手段で情報をやり取りしがちです。本アイデアは、日々の申し送りを共通の「型」に沿って一枚にまとめ、誰が見ても状況がわかる記録方法とその運用ルールを提案します。',
    problem:
      '連絡手段が電話・メモ・メッセージアプリに分散し、体調の変化や服薬の状況が一部の人にしか伝わらない。結果として確認の連絡が増え、介護する家族の負担が大きくなっている。',
    targetCustomers:
      '在宅介護を行う家族、ケア関連の事業者、地域の支援団体、介護関連サービスを検討する事業会社。',
    differentiation:
      '新たな専用機器やアプリの導入を前提とせず、紙でもデジタルでも使える記録の「型」と運用ルールに焦点を当てている点。導入のハードルが低く、既存の連絡手段と併用できる。',
    validation: {
      stage: 'interviewed',
      activities: ['在宅介護を行う家族への聞き取り（架空のデモ記載）', '記録項目の試作と試用', '関連制度の机上調査'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '課題・提案・根拠・リスク・検証計画を整理した文書' },
      { name: '記録の型（テンプレート案）', description: '申し送り項目と記入ルールの設計案' },
      { name: '知識マップ（完全版）', description: '課題・仮説・根拠・反証の関係を示した構造図' },
      { name: '検証メモ', description: '試用で得られた気づきの要約' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '申し送りを一枚に', 260, 0],
        ['n2', 'problem', '連絡手段の分散', 0, 140],
        ['n3', 'hypothesis', '型があれば記入が続く', 260, 140],
        ['n4', 'evidence', '試用での継続（非公開）', 520, 140],
        ['n5', 'solution', '共通の記録項目', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n1', 'n3', 'relates'],
        ['n4', 'n3', 'supports'],
        ['n3', 'n5', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 92,
    hiddenNotice: `記録項目の具体的な構成と運用ルールの詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-09-12T09:00:00.000Z',
    publishedAt: '2026-08-10T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-local-lesson',
    creatorId: 'c_hoshino',
    title: '地域の仕事を「一日教材」にする探究学習プログラム',
    catchcopy: '地元の働く人の一日を、中高生の探究テーマに変える仕組み。',
    category: '教育',
    tags: ['探究学習', '地域', 'キャリア教育'],
    summary:
      '地域で働く人の一日の仕事を、生徒が問いを立てて調べられる教材に変換するプログラムの構想です。学校側の準備負担を抑えながら、地域とのつながりを授業に取り込むことを目指します。',
    problem:
      '探究学習のテーマ設定や外部協力者の調整に教員の負担が集中し、地域との連携が一部の熱心な学校・教員に限られている。',
    targetCustomers: '中学校・高等学校、教育関連事業者、地域の商工団体、自治体の教育担当部署。',
    differentiation:
      '講演型の職業紹介ではなく、「一日の仕事」を分解した教材を通じて生徒自身が問いを立てる点。協力者の負担を短時間の取材に限定している。',
    validation: {
      stage: 'researched',
      activities: ['探究学習に関する公開資料の調査', '教材構成の試作'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: 'プログラム全体の構想と根拠' },
      { name: '教材フォーマット案', description: '一日の仕事を分解する設問の型' },
      { name: '知識マップ（完全版）', description: '関係者と価値の流れの整理' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '仕事を一日教材に', 260, 0],
        ['n2', 'problem', 'テーマ設定の負担', 0, 140],
        ['n3', 'fact', '探究学習の必修化', 520, 140],
        ['n4', 'hypothesis', '短時間取材なら協力が得やすい', 260, 140],
        ['n5', 'plan', '協力者3名で試作', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n3', 'n1', 'relates'],
        ['n1', 'n4', 'relates'],
        ['n4', 'n5', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 84,
    hiddenNotice: `設問の具体的な構成と協力者の募り方の詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-09-30T09:00:00.000Z',
    publishedAt: '2026-09-01T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-repair-data',
    creatorId: 'c_kurata',
    title: '修理履歴から「長く使える製品」を見える化する指標',
    catchcopy: '修理のしやすさと実際の修理記録をつなぎ、選ぶ側の判断材料にする。',
    category: '環境',
    tags: ['循環型社会', '修理', 'データ活用'],
    summary:
      '家電や日用品の修理記録を匿名化して集計し、「長く使い続けられるか」を表す指標を設計するアイデアです。買い替えではなく修理という選択を後押しする情報基盤を想定しています。',
    problem:
      '製品の耐久性や修理のしやすさは購入時にわかりにくく、価格や機能だけで選ばれがち。結果として修理可能な製品も短期間で廃棄されている。',
    targetCustomers: '修理事業者、小売事業者、製品メーカーの企画部門、環境分野の自治体・団体。',
    differentiation:
      'カタログ上の仕様ではなく、実際の修理記録に基づく点。メーカーを評価するランキングではなく、使い手の判断材料として設計している。',
    validation: {
      stage: 'prototyped',
      activities: ['公開統計の分析', '架空データによる指標の試算', '指標表示の簡易試作'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '指標の考え方・根拠・リスク' },
      { name: '指標設計書', description: '算出方法と前提条件' },
      { name: '知識マップ（完全版）', description: '仮説と反証の整理' },
      { name: '試算シートの構成案', description: '必要なデータ項目の一覧' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '修理しやすさの指標', 260, 0],
        ['n2', 'problem', '耐久性が見えない', 0, 140],
        ['n3', 'hypothesis', '指標があれば選択が変わる', 260, 140],
        ['n4', 'counter', '価格優先の層には届かない', 520, 140],
        ['n5', 'evidence', '試算の傾向（非公開）', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n1', 'n3', 'relates'],
        ['n4', 'n3', 'refutes'],
        ['n5', 'n3', 'supports'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 88,
    hiddenNotice: `指標の算出式と重み付けの詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-07-11T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    publishedAt: '2026-07-25T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-stock-guide',
    creatorId: 'c_nishida',
    title: '小さな飲食店のための「仕入れ判断カード」',
    catchcopy: '経験と勘に頼る仕入れを、5分で振り返れる判断の型に。',
    category: 'ビジネス',
    tags: ['小規模事業', '食品ロス', '業務改善'],
    summary:
      '小規模な飲食店が、天候・予約・曜日などの条件から仕入れ量を決める際の判断を、カード形式の振り返りツールにするアイデアです。高価なシステムを導入せずに、判断の質を少しずつ高めることを目指します。',
    problem:
      '小規模店では仕入れ判断が店主の経験に依存し、過剰仕入れによる廃棄や欠品による機会損失が起きやすい。システム導入は費用と手間の面でハードルが高い。',
    targetCustomers: '個人経営の飲食店、飲食店向けサービス事業者、食品ロス削減に取り組む団体。',
    differentiation:
      '予測システムではなく「判断の振り返り」に特化し、紙のカードでも運用できる点。店主の経験を置き換えるのではなく、言語化して蓄積する。',
    validation: {
      stage: 'interviewed',
      activities: ['小規模店経営の実体験の整理', '店主への聞き取り（架空のデモ記載）'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '課題・提案・財務仮説' },
      { name: 'カード設計案', description: '振り返り項目と使い方' },
      { name: '知識マップ（完全版）', description: '判断要因の構造' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '仕入れ判断カード', 260, 0],
        ['n2', 'problem', '廃棄と欠品', 0, 140],
        ['n3', 'fact', '判断要因は少数に集約', 520, 140],
        ['n4', 'solution', '5分の振り返り', 260, 140],
        ['n5', 'plan', '3店舗で試用', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n3', 'n4', 'supports'],
        ['n1', 'n4', 'relates'],
        ['n4', 'n5', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 79,
    hiddenNotice: `カードの具体的な項目と判断ルールは非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-10-10T09:00:00.000Z',
    publishedAt: '2026-09-15T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-chores-map',
    creatorId: 'c_mizuno',
    title: '家庭の「名前のない家事」を見える化する家事地図',
    catchcopy: '家族の間で見えにくい家事を地図にして、分担の話し合いを始めやすくする。',
    category: '生活',
    tags: ['家事', '家族', '見える化'],
    summary:
      '献立を考える、日用品の残りを確認する、といった名前のない家事を洗い出し、家族で共有できる「家事地図」として描くアイデアです。分担を決める前の対話のきっかけをつくります。',
    problem:
      '家事の多くは作業として認識されず、特定の家族に負担が偏りやすい。分担の話し合いをしようにも、何がどれだけあるのかが共有されていない。',
    targetCustomers: '共働き・子育て世帯、生活関連サービス事業者、自治体の子育て支援部署。',
    differentiation:
      '分担の「正解」を示すのではなく、家族ごとに異なる家事を可視化して対話を促す点。点数化や評価を目的にしない。',
    validation: {
      stage: 'prototyped',
      activities: ['自宅での試用と記録', '知人家庭での試用（架空のデモ記載）'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '構想・根拠・リスク・検証計画' },
      { name: '家事地図のひな形', description: '家事の分類と描き方の手順' },
      { name: '知識マップ（完全版）', description: '仮説と根拠の整理' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '家事地図', 260, 0],
        ['n2', 'problem', '見えない家事の偏り', 0, 140],
        ['n3', 'hypothesis', '見えると対話が始まる', 260, 140],
        ['n4', 'evidence', '試用時の会話の変化', 520, 140],
        ['n5', 'counter', '可視化が対立を生む可能性', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n1', 'n3', 'relates'],
        ['n4', 'n3', 'supports'],
        ['n5', 'n3', 'refutes'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 90,
    hiddenNotice: `家事の分類体系と描き方の詳細手順は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z',
    publishedAt: '2026-09-20T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-shop-memory',
    creatorId: 'c_aoi',
    title: '閉じゆく商店の技を「町歩きの物語」として残す仕組み',
    catchcopy: '商店主の聞き書きを、観光と後継者探しの入口に変える。',
    category: '地域',
    tags: ['商店街', '文化継承', '観光'],
    summary:
      '閉店を考える商店主の技術や物語を聞き書きし、町歩きのコースとして編集するアイデアです。来訪者に地域の魅力を伝えると同時に、技術を受け継ぎたい人との出会いの入口をつくります。',
    problem:
      '商店の技術や知恵は記録されないまま失われがち。後継者を探す手段も限られ、地域の魅力が外部に伝わらない。',
    targetCustomers: '商店街組合、観光関連事業者、自治体の地域振興部署、地域メディア。',
    differentiation:
      '単なる店舗紹介ではなく、技術と人の物語を軸にした編集である点。後継者との出会いを設計に含めている。',
    validation: {
      stage: 'interviewed',
      activities: ['聞き書きの試行（架空のデモ記載）', 'コース構成の試作'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '構想・関係者・リスク' },
      { name: '聞き書きガイド案', description: '取材の進め方と配慮事項' },
      { name: '知識マップ（完全版）', description: '関係者と価値の流れ' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '技を町歩きの物語に', 260, 0],
        ['n2', 'problem', '技術が記録されない', 0, 140],
        ['n3', 'hypothesis', '物語が来訪動機になる', 260, 140],
        ['n4', 'solution', '聞き書き＋コース編集', 520, 140],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n1', 'n3', 'relates'],
        ['n1', 'n4', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'nondisclosure',
    featuredScore: 81,
    hiddenNotice: `聞き書きの手法とコース編集の詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-08-30T09:00:00.000Z',
    publishedAt: '2026-06-15T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-form-helper',
    creatorId: 'c_asakura',
    title: '行政手続きの「書く前の準備」をそろえるチェックリスト生成',
    catchcopy: '申請書を書き始める前に、必要な情報と書類をそろえる手順の型。',
    category: 'IT',
    tags: ['手続き', 'アクセシビリティ', '情報整理'],
    summary:
      '申請書の記入そのものではなく、記入前に必要な情報・書類・確認先をそろえる準備段階を支援するアイデアです。質問に答えると準備リストができる仕組みを想定しています。',
    problem:
      '手続きの途中で書類の不足に気づき、窓口や家族とのやり取りが何度も発生する。特に高齢者や初めて手続きをする人にとって負担が大きい。',
    targetCustomers: '自治体、行政手続き支援を行う事業者・団体、IT サービス事業者。',
    differentiation:
      '電子申請そのものではなく「書く前」に特化し、紙の手続きにも使える点。',
    validation: {
      stage: 'concept',
      activities: ['公開されている手続き案内の調査'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '構想と検証計画' },
      { name: '質問設計の案', description: '準備リストを導く設問の構成' },
      { name: '知識マップ（完全版）', description: '課題の構造' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '書く前の準備リスト', 260, 0],
        ['n2', 'problem', '途中で書類不足に気づく', 0, 140],
        ['n3', 'hypothesis', '準備段階の支援で往復が減る', 260, 140],
        ['n4', 'plan', '対象手続きを3つに絞り試作', 260, 280],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n1', 'n3', 'relates'],
        ['n3', 'n4', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'published',
    featuredScore: 70,
    hiddenNotice: `設問の具体的な構成と分岐の詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    publishedAt: '2026-10-08T09:00:00.000Z',
    origin: 'seed',
  },
  {
    id: 'idea-craft-rental',
    creatorId: 'c_hoshino',
    title: '学校の使われない時間を地域のものづくり工房に',
    catchcopy: '放課後と休日の技術室を、地域の人が学び合う場所として開く。',
    category: '文化',
    tags: ['ものづくり', '学校施設', '地域'],
    summary:
      '使われていない時間帯の学校の技術室・家庭科室を、地域の人が技術を教え合う工房として活用する運営モデルの構想です。',
    problem:
      '学校の特別教室は放課後や休日に使われないことが多い一方、地域には技術を教えたい人と学びたい人の出会う場が少ない。',
    targetCustomers: '自治体の教育委員会、地域団体、ものづくり関連事業者。',
    differentiation:
      '施設の貸し出しだけでなく、安全管理と教え合いの運営ルールを一体で設計している点。',
    validation: {
      stage: 'researched',
      activities: ['学校施設開放に関する公開資料の調査'],
    },
    deliverables: [
      { name: 'IIP（アイデア情報パッケージ）', description: '運営モデルとリスク' },
      { name: '運営ルール案', description: '安全管理と役割分担' },
    ],
    sampleMap: map(
      [
        ['n1', 'idea', '地域工房として開く', 260, 0],
        ['n2', 'fact', '特別教室の空き時間', 0, 140],
        ['n3', 'counter', '安全管理の負担', 520, 140],
        ['n4', 'solution', '運営ルールの一体設計', 260, 140],
      ],
      [
        ['n2', 'n1', 'leads'],
        ['n3', 'n1', 'refutes'],
        ['n1', 'n4', 'leads'],
      ],
    ),
    price: STANDARD_PRICE,
    status: 'review',
    featuredScore: 60,
    hiddenNotice: `運営ルールの詳細は非公開です。${COMMON_HIDDEN}`,
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-10-25T09:00:00.000Z',
    origin: 'seed',
  },
]

export const DEMO_REVIEWS: ReviewRecord[] = [
  {
    id: 'rv_seed_1',
    ideaId: 'idea-craft-rental',
    submittedBy: 'u_creator',
    status: 'pending',
    checklist: {
      noPersonalInfo: false,
      noMisleadingRights: false,
      problemClear: false,
      evidenceListed: false,
      risksStated: false,
      previewSafe: false,
    },
    comment: '',
    createdAt: '2026-10-25T09:00:00.000Z',
  },
]

export const DEMO_PURCHASES: PurchaseDemo[] = [
  {
    id: 'pd_seed_1',
    ideaId: 'idea-shop-memory',
    ideaTitle: '閉じゆく商店の技を「町歩きの物語」として残す仕組み',
    buyerId: 'u_buyer',
    price: STANDARD_PRICE,
    acceptedTerms: ['scope', 'nondisclosure', 'collaboration', 'demo'],
    nondisclosureMonths: NONDISCLOSURE_MONTHS,
    kind: 'demo',
    createdAt: '2026-08-30T09:00:00.000Z',
  },
]

export const DEMO_CONNECTIONS: ConnectionRequest[] = [
  {
    id: 'cr_seed_1',
    creatorId: 'c_asakura',
    requesterId: 'u_buyer',
    ideaId: 'idea-care-log',
    purpose: '追加の説明を聞きたい',
    message:
      '介護関連の新サービスを検討しています。記録の型を考えた背景について、30分ほどお話を伺えないでしょうか。（デモ用の架空の申請です）',
    collaboration: 'オンラインでの対話（30分程度）',
    status: 'pending',
    requesterConsent: true,
    creatorConsent: null,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
]

/* ---------- サンプルの知識創造プロジェクト（デモ創作者用） ---------- */

export const DEMO_PROJECT: KnowledgeProject = {
  id: 'kp_sample',
  ownerId: 'u_creator',
  title: '通院の付き添いを分かち合う仕組み（サンプル）',
  description: '家族の通院付き添いの負担を、近所や知人で分かち合えないかを考えるサンプルプロジェクトです。',
  memos: [
    {
      id: 'memo_1',
      body: '通院の付き添いは「待ち時間」が長い。付き添いそのものより、半日仕事を休むことが負担になっている。',
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z',
    },
  ],
  structure: { problem: '', customer: '', solution: '', differentiation: '', evidence: '' },
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
}

const t = '2026-10-01T09:00:00.000Z'
export const DEMO_NODES: KnowledgeNode[] = [
  { id: 'kn_1', projectId: 'kp_sample', kind: 'idea', label: '付き添いを分かち合う', detail: '', position: { x: 280, y: 20 }, updatedAt: t },
  { id: 'kn_2', projectId: 'kp_sample', kind: 'problem', label: '半日休む負担が大きい', detail: '待ち時間が長く、仕事を休む必要がある。', position: { x: 20, y: 170 }, updatedAt: t },
  { id: 'kn_3', projectId: 'kp_sample', kind: 'hypothesis', label: '待ち時間だけ交代できれば負担が減る', detail: '', position: { x: 280, y: 170 }, verdict: 'open', updatedAt: t },
  { id: 'kn_4', projectId: 'kp_sample', kind: 'counter', label: '病院側が交代を認めない可能性', detail: '個人情報や同意の扱いを確認する必要がある。', position: { x: 560, y: 170 }, updatedAt: t },
  { id: 'kn_5', projectId: 'kp_sample', kind: 'plan', label: '付き添い経験者5人に聞く', detail: '', position: { x: 280, y: 320 }, updatedAt: t },
]

export const DEMO_EDGES: KnowledgeEdge[] = [
  { id: 'ke_1', projectId: 'kp_sample', source: 'kn_2', target: 'kn_1', relation: 'leads' },
  { id: 'ke_2', projectId: 'kp_sample', source: 'kn_1', target: 'kn_3', relation: 'relates' },
  { id: 'ke_3', projectId: 'kp_sample', source: 'kn_4', target: 'kn_3', relation: 'refutes' },
  { id: 'ke_4', projectId: 'kp_sample', source: 'kn_3', target: 'kn_5', relation: 'leads' },
]

export const DEMO_SOURCES: SourceReference[] = [
  {
    id: 'src_1',
    projectId: 'kp_sample',
    title: '自分の付き添い記録（3か月分）',
    kind: 'other',
    note: '待ち時間の長さをメモしたもの。個人を特定できる情報は記録しない。',
    createdAt: t,
  },
]
