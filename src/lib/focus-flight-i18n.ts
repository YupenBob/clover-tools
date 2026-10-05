import type { Lang } from './i18n';
// @ts-ignore chinese-s2t is a CommonJS package without declarations.
import chineseS2t from 'chinese-s2t';

const zh = {
  subtitle: '让待办暂时安静，给专注一点远行的感觉。',
  boarding: '等待登机', flying: '正在飞行', paused: '航程暂停', landed: '平稳抵达',
  map: '你的专注航线', mapHint: '示意航线 · 时长由你设定',
  remaining: '距离抵达', readyHint: '放下分心的事，下一站是完成。',
  flyingHint: '窗外慢慢变化，手里只做一件事。', pausedHint: '喘口气，再继续这段航程。', landedHint: '这段时间，认真地留给了自己。',
  routes: '今天，想飞去哪里？', routeHint: '选择目的地，换一个专注的心情。',
  cities: ['上海', '东京', '北京', '首尔', '台北', '香港', '新加坡', '成都', '曼谷', '札幌'],
  moods: ['越过海面，去看东京的灯', '给忙碌按暂停，飞向首尔', '留一段时间，抵达维港', '把思绪带到热带的风里', '朝南飞，把一件事做完', '穿过云层，去看北方的雪'],
  ticket: '领取你的登机牌', route: '航线', flight: '航班', seat: '座位', gate: '登机口', cabin: '专注舱',
  task: '这一程，只做一件事', taskPlaceholder: '例如：读完一章书 / 完成今天的设计', taskDefault: '给自己一段专注时间',
  duration: '专注时长', minutes: '分钟', custom: '自定', durationHint: '1–180 分钟，与实际航班时长无关。',
  invalid: '请输入 1–180 的整数分钟。',
  depart: '准备好了，起飞', pause: '暂停航程', resume: '继续飞行', end: '提前结束', again: '再飞一程',
  departure: '出发地', arrival: '目的地', arrivalTime: '预计抵达', arrivalDone: '实际抵达', progress: '航程进度',
  sound: '机舱白噪音', volume: '音量', soundHint: '戴上耳机，听一会儿安静的风。', soundError: '当前浏览器无法播放声音，航程计时仍会继续。',
  chime: '落地时播放提示音', immersive: '沉浸模式', exitImmersive: '退出沉浸', immersiveHint: '按 Esc 退出',
  save: '保存落地纪念卡', saved: '纪念卡已生成。', exportError: '纪念卡生成失败，请重试。',
  history: '你的飞行日志', historyHint: '最近 20 次已完成航程，仅保存在当前浏览器。', empty: '第一段旅程，从一次专注开始。',
  today: '今日记录', landings: '已记录航程', clear: '清空日志', local: '航程自动保存到当前浏览器', storageError: '浏览器未允许本地保存。当前航程可继续，刷新后无法恢复。',
  restored: '已恢复上次航程。', stopTitle: '要在这里结束航程吗？', stopHint: '已完成的专注值得肯定。本次未抵达，不计入飞行日志。', stopConfirm: '结束本次航程', keepFlying: '留在航班上',
  clearTitle: '清空飞行日志？', clearHint: '这会删除当前浏览器的已完成记录，正在进行的航程不受影响。', clearConfirm: '清空记录', cancel: '取消',
  note: '切出页面后计时继续；暂停时停止计时。此工具不会限制你使用其他应用。',
  complete: '欢迎抵达 {city}，完成了 {minutes} 分钟专注。', record: '{minutes} 分钟 · {date}',
  noScript: '请启用 JavaScript，以开始航程、计时和保存日志。',
};
export type FlightText = typeof zh;
const en: FlightText = {
  subtitle: 'Let your to-do list settle. Take your focus somewhere new.',
  boarding: 'Ready to board', flying: 'In flight', paused: 'Flight paused', landed: 'Safely landed',
  map: 'Your focus route', mapHint: 'Illustrated route · your own duration', remaining: 'Until arrival',
  readyHint: 'Set distractions aside. Your next stop is done.', flyingHint: 'A changing view. Just one thing to do.', pausedHint: 'Take a breath. Your journey can wait.', landedHint: 'A little time, thoughtfully spent on yourself.',
  routes: 'Where will you go today?', routeHint: 'Pick a destination and a fresh frame of mind.',
  cities: ['Shanghai', 'Tokyo', 'Beijing', 'Seoul', 'Taipei', 'Hong Kong', 'Singapore', 'Chengdu', 'Bangkok', 'Sapporo'],
  moods: ['Across the sea, toward the city lights', 'A quiet pause on your way to Seoul', 'A little time, a harbor view', 'Let your thoughts catch a tropical breeze', 'Head south. Finish one thing.', 'Through the clouds, toward northern snow'],
  ticket: 'Your boarding pass', route: 'Route', flight: 'Flight', seat: 'Seat', gate: 'Gate', cabin: 'Focus cabin',
  task: 'One thing for this journey', taskPlaceholder: 'Read one chapter / Finish today’s design', taskDefault: 'Some time to focus',
  duration: 'Focus duration', minutes: 'min', custom: 'Custom', durationHint: '1–180 minutes. Independent of real flight times.', invalid: 'Enter a whole number of minutes from 1 to 180.',
  depart: 'Ready for takeoff', pause: 'Pause flight', resume: 'Resume flight', end: 'End early', again: 'Fly again',
  departure: 'Departure', arrival: 'Destination', arrivalTime: 'Expected arrival', arrivalDone: 'Arrived at', progress: 'Flight progress',
  sound: 'Cabin ambience', volume: 'Volume', soundHint: 'Headphones on. A quiet breeze for company.', soundError: 'Audio is unavailable in this browser. Your timer will keep running.',
  chime: 'Play a sound on arrival', immersive: 'Immersive view', exitImmersive: 'Exit immersive view', immersiveHint: 'Press Esc to exit',
  save: 'Save arrival card', saved: 'Your arrival card is ready.', exportError: 'Could not create the card. Please try again.',
  history: 'Your flight log', historyHint: 'Your last 20 completed flights, saved in this browser.', empty: 'Your first journey starts with a little focus.',
  today: 'Today in log', landings: 'Flights in log', clear: 'Clear log', local: 'This flight is saved automatically in your browser', storageError: 'Local storage is unavailable. Your flight can continue, but cannot be restored after a reload.',
  restored: 'Your previous flight has been restored.', stopTitle: 'End your flight here?', stopHint: 'Every focused minute counts. This unfinished flight will not appear in your log.', stopConfirm: 'End this flight', keepFlying: 'Stay on board',
  clearTitle: 'Clear your flight log?', clearHint: 'This deletes completed records in this browser. Your current flight continues.', clearConfirm: 'Clear records', cancel: 'Cancel',
  note: 'Time continues in other tabs and stops when paused. This tool does not block other apps.',
  complete: 'Welcome to {city}. You completed {minutes} minutes of focus.', record: '{minutes} min · {date}', noScript: 'Enable JavaScript to start a flight, run the timer and save your log.',
};
const ko: FlightText = {
  subtitle: '할 일은 잠시 조용히, 집중에는 여행의 기분을.',
  boarding: '탑승 대기', flying: '비행 중', paused: '비행 일시정지', landed: '안전하게 도착',
  map: '나의 집중 항로', mapHint: '항로는 예시 · 시간은 직접 설정', remaining: '도착까지', readyHint: '다른 생각은 내려놓고, 한 가지를 끝내 보세요.', flyingHint: '창밖은 천천히 바뀌고, 지금은 한 가지에만.', pausedHint: '숨을 고르고 다시 출발해요.', landedHint: '나를 위해 온전히 보낸 시간.',
  routes: '오늘은 어디로 떠날까요?', routeHint: '목적지를 고르고 새로운 기분으로 집중해요.',
  cities: ['상하이', '도쿄', '베이징', '서울', '타이베이', '홍콩', '싱가포르', '청두', '방콕', '삿포로'], moods: ['바다를 넘어 도쿄의 불빛으로', '잠깐의 여유, 서울로 가는 길', '잠시 집중하고 빅토리아 항으로', '생각에 열대의 바람을', '남쪽으로 날며 한 가지를 끝내요', '구름을 넘어 북쪽의 눈을 보러'],
  ticket: '나의 탑승권', route: '항로', flight: '편명', seat: '좌석', gate: '탑승구', cabin: '집중석', task: '이번 여행에서 할 한 가지', taskPlaceholder: '책 한 장 읽기 / 오늘의 디자인 완성', taskDefault: '나를 위한 집중 시간',
  duration: '집중 시간', minutes: '분', custom: '직접 설정', durationHint: '1–180분. 실제 비행시간과 무관합니다.', invalid: '1–180 사이의 정수 분을 입력하세요.',
  depart: '준비됐어요, 출발', pause: '비행 일시정지', resume: '비행 계속하기', end: '일찍 종료', again: '다시 떠나기', departure: '출발지', arrival: '목적지', arrivalTime: '도착 예정', arrivalDone: '도착 시간', progress: '비행 진행률',
  sound: '기내 백색소음', volume: '음량', soundHint: '헤드폰과 함께 조용한 바람을 들어요.', soundError: '이 브라우저에서 소리를 재생할 수 없습니다. 타이머는 계속됩니다.', chime: '도착 시 알림음 재생', immersive: '몰입 모드', exitImmersive: '몰입 모드 나가기', immersiveHint: 'Esc로 나가기',
  save: '도착 기념 카드 저장', saved: '기념 카드가 완성됐어요.', exportError: '카드를 만들지 못했습니다. 다시 시도하세요.',
  history: '나의 비행 일지', historyHint: '완료한 최근 비행 20회가 현재 브라우저에 저장됩니다.', empty: '첫 여행은 한 번의 집중에서 시작해요.', today: '오늘의 집중', landings: '누적 도착', clear: '일지 비우기', local: '비행이 현재 브라우저에 자동 저장됩니다', storageError: '로컬 저장을 사용할 수 없습니다. 현재 비행은 계속되지만 새로고침 후 복원할 수 없습니다.',
  restored: '이전 비행을 복원했습니다.', stopTitle: '여기서 비행을 종료할까요?', stopHint: '집중한 시간은 소중해요. 도착하지 않은 비행은 일지에 기록되지 않습니다.', stopConfirm: '이번 비행 종료', keepFlying: '비행 계속하기', clearTitle: '비행 일지를 비울까요?', clearHint: '이 브라우저의 완료 기록을 삭제합니다. 현재 비행은 계속됩니다.', clearConfirm: '기록 삭제', cancel: '취소',
  note: '다른 탭에서도 시간이 흐르며 일시정지하면 멈춥니다. 다른 앱 사용을 차단하지 않습니다.', complete: '{city}에 도착했습니다. {minutes}분 집중을 완료했어요.', record: '{minutes}분 · {date}', noScript: '비행 시작, 타이머 및 일지 저장을 위해 JavaScript를 활성화하세요.',
};
const ja: FlightText = {
  subtitle: 'やることをひとつに。集中に、旅する気分を。', boarding: '搭乗待ち', flying: '飛行中', paused: 'フライト一時停止', landed: '無事に到着',
  map: 'あなたの集中ルート', mapHint: 'ルートはイメージ · 時間は自由に設定', remaining: '到着まで', readyHint: '気が散ることを置いて、ひとつを終える旅へ。', flyingHint: '窓の外はゆっくり変わる。今はひとつだけ。', pausedHint: 'ひと息ついて、また続きを。', landedHint: '自分のために、大切に使った時間。',
  routes: '今日はどこへ飛びますか？', routeHint: '目的地を選んで、気分を変えて集中。', cities: ['上海', '東京', '北京', 'ソウル', '台北', '香港', 'シンガポール', '成都', 'バンコク', '札幌'], moods: ['海を越えて、東京の灯りへ', 'ひと息ついて、ソウルへ', '集中の先に、港の風景', '思いを南国の風に乗せて', '南へ飛んで、ひとつを仕上げる', '雲を抜けて、北の雪を見に'],
  ticket: 'あなたの搭乗券', route: 'ルート', flight: '便名', seat: '座席', gate: 'ゲート', cabin: '集中席', task: 'この旅でやる、ひとつのこと', taskPlaceholder: '本を一章読む / 今日のデザインを仕上げる', taskDefault: '自分のための集中時間', duration: '集中時間', minutes: '分', custom: '自由設定', durationHint: '1–180分。実際の飛行時間とは異なります。', invalid: '1–180の整数で分数を入力してください。',
  depart: '準備できたら、離陸', pause: '一時停止', resume: 'フライトを再開', end: '途中で終了', again: 'もう一度飛ぶ', departure: '出発地', arrival: '目的地', arrivalTime: '到着予定', arrivalDone: '到着時刻', progress: 'フライトの進行', sound: '機内のホワイトノイズ', volume: '音量', soundHint: 'ヘッドホンで、静かな風を聴きながら。', soundError: 'このブラウザでは音を再生できません。タイマーは続きます。', chime: '到着時に音で知らせる', immersive: '集中モード', exitImmersive: '集中モードを終了', immersiveHint: 'Escで終了', save: '到着記念カードを保存', saved: '記念カードができました。', exportError: 'カードを作成できませんでした。もう一度お試しください。',
  history: 'あなたのフライトログ', historyHint: '完了した直近20回のフライトを、このブラウザに保存。', empty: '最初の旅は、一度の集中から。', today: '今日の集中', landings: '到着回数', clear: 'ログを消去', local: 'フライトはこのブラウザに自動保存されます', storageError: 'ローカル保存を利用できません。フライトは続けられますが、再読み込み後は復元できません。', restored: '前回のフライトを復元しました。', stopTitle: 'ここでフライトを終了しますか？', stopHint: '集中した時間は大切です。未到着のフライトはログに残りません。', stopConfirm: 'このフライトを終了', keepFlying: 'フライトを続ける', clearTitle: 'フライトログを消去しますか？', clearHint: 'このブラウザの完了記録を削除します。現在のフライトは続きます。', clearConfirm: '記録を消去', cancel: 'キャンセル', note: '別のタブでも計時は続き、一時停止中は止まります。他のアプリの使用は制限しません。', complete: '{city}に到着しました。{minutes}分の集中を完了。', record: '{minutes}分 · {date}', noScript: 'フライトの開始、計時、ログ保存にはJavaScriptを有効にしてください。',
};
export function flightText(lang: Lang): FlightText {
  if (lang === 'tw') return JSON.parse(chineseS2t.s2t(JSON.stringify(zh)));
  return ({ zh, en, ko, ja } as Record<string, FlightText>)[lang] ?? zh;
}
