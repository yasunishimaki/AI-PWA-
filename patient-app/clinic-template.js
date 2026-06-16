// ============================================
// クリニック別 問診テンプレート定義
// ============================================
// クライアント（クリニック）ごとに、聞き取るべき項目をここで定義する。
// デモ版は「クレアスクリニック（一般内科を想定）」を固定で使用する。
//
// 将来は複数クリニックを CLINIC_TEMPLATES に追加し、
// state.clinicId を切り替えるだけでテンプレートを差し替えられる設計。
// ============================================

const CLINIC_TEMPLATES = {
  // ---------- クレアスクリニック（デモ用・一般内科） ----------
  creas: {
    clinicId: 'creas',
    clinicName: 'クレアスクリニック',
    department: '一般内科',
    // 患者への最初の問いかけ
    openingPrompt: '今日はどうされましたか？お困りのこと・気になる症状を、自由にお話しください。',

    // 【コア項目】主訴に関わらず必ず確認する9項目
    coreItems: [
      { key: 'chiefComplaint', label: '主訴',          icon: '🎯', question: '今日、一番つらい・気になる症状は何ですか？' },
      { key: 'onset',          label: '発症時期',      icon: '📅', question: 'その症状は、いつ頃から始まりましたか？' },
      { key: 'quality',        label: '症状の性質',    icon: '🔍', question: 'どんな症状か、もう少し詳しく教えてください。' },
      { key: 'medication',     label: '服薬中の薬',    icon: '💊', question: '今、飲んでいるお薬はありますか？（市販薬・処方薬どちらも）', highlight: true },
      { key: 'allergy',        label: 'アレルギー',    icon: '⚠️', question: '薬や食べ物で、アレルギーはありますか？',               highlight: true },
      { key: 'history',        label: '既往歴',        icon: '🏥', question: 'これまでにかかった大きな病気や、通院中の持病はありますか？' },
      { key: 'fever',          label: '発熱の有無',    icon: '🌡️', question: '熱はありますか？ある場合は、何度くらいですか？' },
      { key: 'travel',         label: '海外渡航歴',    icon: '✈️', question: '最近2週間以内に、海外へ行かれましたか？' },
      { key: 'family',         label: '同居家族の体調', icon: '👪', question: '一緒に住んでいるご家族で、同じような症状の方はいますか？' },
    ],

    // 【主訴別 追加項目】最初の発話内容にキーワードが含まれていれば動的に追加する
    conditionalGroups: [
      {
        id: 'pain',
        label: '痛み系（OPQRST）',
        match: ['痛', 'いたい', 'いたみ', 'いたく', 'ズキズキ', 'ずきずき', 'キリキリ', 'しくしく', 'ヒリヒリ', 'ちくちく', 'お腹が張る', 'おなかが張る'],
        items: [
          { key: 'pain_onset',     label: '発症のしかた',   icon: '⏱️', question: 'その痛みは、急に始まりましたか？それともだんだんですか？' },
          { key: 'pain_provoke',   label: '増悪・軽快因子', icon: '🔥', question: 'どんな時に痛みが強くなったり、楽になったりしますか？' },
          { key: 'pain_quality',   label: '痛みの性質',     icon: '🔍', question: 'どんな痛みですか？（ズキズキ／鈍い／刺すような など）' },
          { key: 'pain_region',    label: '部位・放散',     icon: '📍', question: 'どこが痛みますか？他の場所に広がる感じはありますか？' },
          { key: 'pain_severity',  label: '痛みの強さ',     icon: '📊', question: '痛みの強さは10段階でどのくらいですか？（10が最も強い）' },
          { key: 'pain_timing',    label: '時間経過',       icon: '📈', question: '痛みはずっと続きますか？波がありますか？' },
        ],
      },
      {
        id: 'fever',
        label: '発熱',
        match: ['熱', '発熱', 'ねつ', '寒気', '悪寒', '微熱'],
        items: [
          { key: 'fever_course',     label: '熱の経過',   icon: '📈', question: '熱はいつからで、上がったり下がったりしていますか？' },
          { key: 'fever_associated', label: '随伴症状',   icon: '➕', question: '熱以外に、喉の痛み・咳・体の痛み・下痢などはありますか？' },
        ],
      },
      {
        id: 'chronic',
        label: '慢性的な悩み',
        match: ['ずっと', '前から', '慢性', '長く', '長い', 'いつも', 'だるい', '倦怠', '疲れ'],
        items: [
          { key: 'chronic_course', label: '経過の詳細',   icon: '📜', question: 'これまでの経過を教えてください。良くなったり悪くなったりしていますか？' },
          { key: 'chronic_impact', label: '生活への影響', icon: '🏠', question: '日常生活や仕事・睡眠への影響はありますか？' },
        ],
      },
      {
        id: 'child',
        label: '子ども',
        match: ['子ども', 'こども', '息子', '娘', '赤ちゃん', '乳児', '幼児', '小児'],
        items: [
          { key: 'child_mood',     label: '機嫌',   icon: '🙂', question: 'お子さんの機嫌はいかがですか？ぐったりしていませんか？' },
          { key: 'child_appetite', label: '食欲',   icon: '🍚', question: '食欲やミルク・母乳の飲みはどうですか？' },
          { key: 'child_stool',    label: '便の様子', icon: '🚽', question: '便の様子（回数・かたさ・色）はいかがですか？' },
        ],
      },
    ],
  },
};

// デモ版で使用するクリニック（固定）
const ACTIVE_CLINIC_ID = 'creas';
