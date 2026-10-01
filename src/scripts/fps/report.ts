import {
  FPS_CONFIG,
  GAME_PROFILES,
  WEAPON_PROFILES,
  TRAINING_MODES,
} from '../../../config/fps.mjs';
import { clamp } from './math.ts';
import { comparisonKey, type FpsStorage } from './storage.ts';
import type { FpsText } from '../../lib/fps-i18n';
import type { SessionResult, Settings } from './types.ts';
import { byId } from '../toolkit';

const $ = <T extends HTMLElement>(id: string) => byId<T>(id);
function node(tag: string, text?: string) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
}
function table(headers: string[], rows: (string | HTMLElement)[][]) {
  const table = node('table'),
    head = node('thead'),
    heading = node('tr'),
    body = node('tbody');
  for (const text of headers) heading.append(node('th', text));
  head.append(heading);
  table.append(head, body);
  for (const row of rows) {
    const tr = node('tr');
    for (const value of row) {
      const td = node('td');
      td.append(typeof value === 'string' ? document.createTextNode(value) : value);
      tr.append(td);
    }
    body.append(tr);
  }
  return table;
}
function svg(tag: string, attributes: Record<string, string | number>, text?: string) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  if (text) el.textContent = text;
  return el;
}
function format(key: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (['accuracy', 'headRate', 'firstRate', 'movingRate', 'coverage'].includes(key))
    return `${(value * 100).toFixed(1)}%`;
  if (key.endsWith('Ms')) return `${value.toFixed(0)} ms`;
  if (key.endsWith('Degrees')) return `${value.toFixed(2)}°`;
  if (key === 'elapsed') return `${value.toFixed(1)} s`;
  return String(value);
}
export function renderReport(result: SessionResult, t: FpsText) {
  $('fpsCompletion').textContent = result.completed ? t.completed : t.interrupted;
  const metrics = $('fpsMetrics');
  metrics.replaceChildren();
  const policy = TRAINING_MODES[result.settings.mode as keyof typeof TRAINING_MODES];
  const ball = 'ball' in policy && policy.ball;
  $('fpsImpactTitle').textContent = ball ? t.ballImpactTitle : t.impactTitle;
  $('fpsImpactHint').textContent = ball ? t.ballImpactHint : t.impactHint;
  $('fpsImpactChart').setAttribute('aria-label', ball ? t.ballImpactTitle : t.impactTitle);
  for (const key of [
    'elapsed',
    'shots',
    'hits',
    'targets',
    'accuracy',
    ...(ball ? [] : ['headRate']),
    ...policy.metrics,
  ]) {
    const tile = node('div');
    tile.className = 'fps-metric';
    tile.dataset.metric = key;
    tile.append(
      node('small', t[key as keyof FpsText]),
      node('strong', format(key, result[key as keyof SessionResult] as number | null)),
    );
    metrics.append(tile);
  }
  const chart = document.getElementById('fpsImpactChart')!;
  chart.replaceChildren();
  const span = FPS_CONFIG.scene.impacts.reportSpanDegrees;
  chart.append(
    svg('line', {
      x1: 200,
      x2: 200,
      y1: 10,
      y2: 230,
      stroke: 'var(--border-strong)',
    }),
    svg('line', {
      x1: 10,
      x2: 390,
      y1: 120,
      y2: 120,
      stroke: 'var(--border-strong)',
    }),
    svg('circle', {
      cx: 200,
      cy: 120,
      r: 12,
      fill: 'none',
      stroke: 'var(--primary)',
    }),
    svg('text', { x: 207, y: 115, fill: 'var(--text-secondary)', 'font-size': 10 }, '0°'),
  );
  for (const shot of result.impacts)
    chart.append(
      svg('circle', {
        cx: 200 + clamp(shot.errorX / span, -1, 1) * 185,
        cy: 120 - clamp(shot.errorY / span, -1, 1) * 105,
        r: 2.5,
        fill:
          shot.region === 'head' ? 'var(--primary)' : shot.region ? 'var(--info)' : 'var(--error)',
        opacity: 0.75,
      }),
    );
  const timeline = document.getElementById('fpsTimeline')!;
  timeline.replaceChildren();
  const first = result.timeline[0]?.time ?? 0,
    last = result.timeline.at(-1)?.time ?? first;
  const duration = Math.max(FPS_CONFIG.feedback.timelineWindow, last - first);
  const lanes = { move: 20, release: 48, stable: 76, shot: 104 };
  for (const [kind, y] of Object.entries(lanes)) {
    timeline.append(
      svg(
        'text',
        { x: 8, y: y + 4, fill: 'var(--text-secondary)', 'font-size': 10 },
        t[(kind + 'Event') as keyof FpsText],
      ),
      svg('line', { x1: 150, x2: 680, y1: y, y2: y, stroke: 'var(--border)' }),
    );
  }
  for (const event of result.timeline) {
    const marker = svg('circle', {
      cx: 150 + ((event.time - first) / duration) * 530,
      cy: lanes[event.kind],
      r: 4,
      fill:
        event.kind === 'shot' &&
        event.speed >
          WEAPON_PROFILES[result.settings.weapon as keyof typeof WEAPON_PROFILES].values.maxSpeed *
            GAME_PROFILES[result.settings.game as keyof typeof GAME_PROFILES].values.stopRatio
          ? 'var(--error)'
          : event.kind === 'stable'
            ? 'var(--success)'
            : 'var(--primary)',
    });
    marker.append(
      svg('title', {}, `${t[(event.kind + 'Event') as keyof FpsText]} ${event.time.toFixed(3)} s`),
    );
    timeline.append(marker);
  }
}
export function renderSources(settings: Settings, t: FpsText) {
  const container = $('fpsSources');
  container.replaceChildren();
  for (const profile of [
    GAME_PROFILES[settings.game as keyof typeof GAME_PROFILES],
    WEAPON_PROFILES[settings.weapon as keyof typeof WEAPON_PROFILES],
  ]) {
    container.append(node('h4', profile.name));
    const rows = Object.entries(profile.evidence).map(([key, evidence]) => {
      const status = node('span', t[evidence.status as keyof FpsText]);
      status.title = `${evidence.version}: ${evidence.field || evidence.source}`;
      if (evidence.source.startsWith('https://')) {
        const link = node('a', t[evidence.status as keyof FpsText]) as HTMLAnchorElement;
        link.href = evidence.source;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = status.title;
        return [
          key,
          JSON.stringify(profile.values[key as keyof typeof profile.values]),
          evidence.unit,
          link,
        ];
      }
      return [
        key,
        JSON.stringify(profile.values[key as keyof typeof profile.values]),
        evidence.unit,
        status,
      ];
    });
    container.append(table([t.keys, t.value, t.unit, t.status], rows));
  }
}
export function renderHistory(storage: FpsStorage, settings: Settings, t: FpsText, lang: string) {
  const container = $('fpsHistory');
  container.replaceChildren();
  const history = storage.history();
  if (!history.length) {
    container.append(node('p', t.empty));
    return;
  }
  const matching = history.filter(
    (item) =>
      item.completed && item.comparisonKey === comparisonKey(settings) && item.accuracy !== null,
  );
  if (matching.length)
    container.append(
      node(
        'p',
        `${t.sameSetup}: ${matching.length} · ${t.accuracy} ${format('accuracy', Math.max(...matching.map((item) => item.accuracy!)))}`,
      ),
    );
  const locale = { zh: 'zh-CN', tw: 'zh-TW', en: 'en', ko: 'ko', ja: 'ja' }[lang] || 'en';
  const rows = history.map((item) => [
    new Date(item.timestamp).toLocaleString(locale),
    `${GAME_PROFILES[item.settings.game as keyof typeof GAME_PROFILES]?.name || item.settings.game} / ${WEAPON_PROFILES[item.settings.weapon as keyof typeof WEAPON_PROFILES]?.name || item.settings.weapon}`,
    t[item.settings.mode as keyof FpsText] || item.settings.mode,
    format('accuracy', item.accuracy),
    item.completed ? t.completed : t.interrupted,
  ]);
  container.append(table([t.history, t.weapon, t.mode, t.accuracy, t.status], rows));
}
