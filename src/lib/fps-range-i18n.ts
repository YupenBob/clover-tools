/** Range controls shared by all locale routes. Traditional Chinese uses the existing conversion. */
const zh = {
  quickStart: '快速训练',
  botWarmup: 'Bot 靶场热身',
  ballWarmup: '小球点击训练',
  recoilWarmup: '步枪压枪',
  rangeIntro:
    '在原创 Bot 靶场连续爆头热身，或打随机小球练点击与切换。训练区域、移动 Bot 与无限子弹都可设置。',
  botOptions: 'Bot 靶场设置',
  sector: '训练区域',
  front: '正前方 90°',
  half: '前半场 180°',
  surround: '四周 360°',
  movingBots: '移动 Bot',
  infiniteAmmo: '无限子弹',
  headOnlyBots: '仅爆头完成目标',
  turnMultiplier: '浏览器转向倍率',
  turnHint:
    '默认 {multiplier}×，让浏览器转向更利落。设为 1× 使用游戏灵敏度系数；填写 cm/360 或完成校准后优先使用校准手感，不叠加倍率。',
  referenceGain: '理论参考',
  ballImpactTitle: '弹着相对小球中心的角度分布',
  ballImpactHint: '蓝色为小球命中，红色为未命中；边缘点表示超出图表范围。',
  ballCoverage: '小球瞄准时间占比',
  dots: '小球点击',
  dotsDesc: '多颗小球随机变换高度，命中后快速刷新，练点击与切换。',
  kills: '完成目标',
  ballSizeHint: '难度会调整小球和头部尺寸。小球点击关闭散布与后坐力，专注点击准确性。',
};
type RangeText = typeof zh;
const en: RangeText = {
  quickStart: 'Quick practice',
  botWarmup: 'Bot range warm-up',
  ballWarmup: 'Small-ball clicking',
  recoilWarmup: 'Rifle recoil',
  rangeIntro:
    'Warm up with repeated headshots in an original bot range, or click small balls to practice switching. Choose sectors, moving bots and unlimited ammo.',
  botOptions: 'Bot range settings',
  sector: 'Training sector',
  front: 'Front 90°',
  half: 'Front half 180°',
  surround: 'All around 360°',
  movingBots: 'Moving bots',
  infiniteAmmo: 'Unlimited ammo',
  headOnlyBots: 'Headshots to complete targets',
  turnMultiplier: 'Browser turn multiplier',
  turnHint:
    'Default {multiplier}× for quicker browser turns. Use 1× for the game sensitivity coefficient. A cm/360 value or saved calibration takes priority without this multiplier.',
  referenceGain: 'Theoretical reference',
  ballImpactTitle: 'Shot angles relative to ball center',
  ballImpactHint: 'Blue: ball hit. Red: miss. Edge points are outside the chart range.',
  ballCoverage: 'Time aiming at balls',
  dots: 'Small-ball clicking',
  dotsDesc:
    'Balls appear at varying heights and refresh quickly after a hit. Practice clicks and switches.',
  kills: 'Targets completed',
  ballSizeHint:
    'Difficulty changes ball and head size. Ball clicking disables spread and recoil to focus on precision.',
};
const ko: RangeText = {
  quickStart: '빠른 연습',
  botWarmup: '봇 사격장 워밍업',
  ballWarmup: '작은 공 클릭 연습',
  recoilWarmup: '소총 반동 연습',
  rangeIntro:
    '독자적인 봇 사격장에서 헤드샷을 반복하거나 작은 공을 클릭해 목표 전환을 연습하세요. 구역, 이동 봇과 무한 탄약을 설정할 수 있습니다.',
  botOptions: '봇 사격장 설정',
  sector: '훈련 구역',
  front: '정면 90°',
  half: '앞쪽 180°',
  surround: '전체 360°',
  movingBots: '이동 봇',
  infiniteAmmo: '무한 탄약',
  headOnlyBots: '헤드샷으로만 목표 완료',
  turnMultiplier: '브라우저 회전 배율',
  turnHint:
    '기본 {multiplier}×로 빠르게 회전합니다. 게임 감도 계수를 쓰려면 1×로 설정하세요. cm/360 또는 저장된 보정은 배율 없이 우선 적용됩니다.',
  referenceGain: '이론상 참고값',
  ballImpactTitle: '공 중심 기준 탄착 각도',
  ballImpactHint: '파랑: 공 명중. 빨강: 빗나감. 가장자리 점은 표시 범위 밖입니다.',
  ballCoverage: '공 조준 시간 비율',
  dots: '작은 공 클릭',
  dotsDesc: '높이가 다른 공을 맞히면 빠르게 새로 나타납니다. 클릭과 목표 전환을 연습하세요.',
  kills: '완료한 목표',
  ballSizeHint:
    '난이도에 따라 공과 머리 크기가 달라집니다. 공 클릭에서는 탄퍼짐과 반동 없이 정확도를 연습합니다.',
};
const ja: RangeText = {
  quickStart: 'クイック練習',
  botWarmup: 'Bot射撃場でウォームアップ',
  ballWarmup: '小球クリック練習',
  recoilWarmup: 'ライフル反動練習',
  rangeIntro:
    'オリジナルのBot射撃場でヘッドショットを繰り返すか、小球をクリックして切り替えを練習。範囲、移動Bot、無限弾薬を設定できます。',
  botOptions: 'Bot射撃場の設定',
  sector: '練習範囲',
  front: '正面90°',
  half: '前方180°',
  surround: '全周360°',
  movingBots: '移動Bot',
  infiniteAmmo: '無限弾薬',
  headOnlyBots: 'ヘッドショットでのみ目標完了',
  turnMultiplier: 'ブラウザー旋回倍率',
  turnHint:
    '初期値{multiplier}×で素早く旋回。ゲーム感度係数を使う場合は1×に設定します。cm/360または保存した校正を優先し、倍率は重ねません。',
  referenceGain: '理論上の参考値',
  ballImpactTitle: '小球中心からの着弾角度',
  ballImpactHint: '青は小球への命中、赤はミス。端の点は表示範囲外です。',
  ballCoverage: '小球を狙った時間の割合',
  dots: '小球クリック',
  dotsDesc: '高さの異なる小球が命中後すぐに再出現。クリックと切り替えを練習します。',
  kills: '完了した目標',
  ballSizeHint:
    '難易度で小球と頭部の大きさが変わります。小球クリックは拡散と反動を無効にし、クリック精度を練習します。',
};
export const FPS_RANGE_TEXT = { zh, en, ko, ja };
export type FpsRangeText = RangeText;
