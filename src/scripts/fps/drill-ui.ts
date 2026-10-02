import { FPS_CONFIG, TRAINING_MODES } from '../../../config/fps.mjs';
import type { FpsText } from '../../lib/fps-i18n.ts';
import type { TrainingSession } from './core.ts';
import type { DrillReason, Settings } from './types.ts';
import { byId } from '../toolkit';

export const REASON_TEXT: Record<DrillReason, keyof FpsText> = {
  success: 'drillSuccess',
  moving: 'drillMoving',
  miss: 'drillMiss',
  travel: 'drillTravel',
  side: 'drillSide',
  lane: 'drillLane',
  return: 'drillReturning',
};
const steps = (kind: string) =>
  kind === 'strafe'
    ? ['drillMove', 'drillStop', 'drillFire']
    : ['drillPeek', 'drillFire', 'drillReturn'];
function sequence(container: HTMLElement, labels: string[], active?: number) {
  container.replaceChildren(
    ...labels.map((label, index) => {
      const item = document.createElement('span');
      item.dataset.active = String(index === active);
      item.dataset.done = String(active !== undefined && index < active);
      const number = document.createElement('b');
      number.textContent = String(index + 1).padStart(2, '0');
      item.append(number, document.createTextNode(label));
      return item;
    }),
  );
}
export function renderDrillBrief(settings: Settings, t: FpsText) {
  const policy = TRAINING_MODES[settings.mode as keyof typeof TRAINING_MODES];
  const kind = 'drill' in policy ? policy.drill : undefined;
  const panel = byId<HTMLElement>('fpsDrillBrief');
  panel.hidden = !kind;
  if (!kind) return;
  panel.dataset.kind = kind;
  byId<HTMLElement>('fpsBriefName').textContent = t[kind];
  byId<HTMLElement>('fpsBriefGoal').textContent = t[kind === 'strafe' ? 'strafeGoal' : 'peekGoal'];
  sequence(
    byId('fpsBriefSteps'),
    steps(kind).map((key) => t[key as keyof FpsText]),
  );
}
export function renderDrillHud(session: TrainingSession, t: FpsText) {
  const panel = byId<HTMLElement>('fpsDrillCoach');
  const drill = session.drill;
  panel.hidden = !drill;
  byId<HTMLElement>('fpsKillsLabel').textContent = drill ? t.drillPasses : t.kills;
  if (!drill) return;
  panel.dataset.drillPhase = drill.phase;
  panel.dataset.round = String(drill.round);
  panel.dataset.side = String(drill.side);
  const side = `${drill.side > 0 ? '→' : '←'} ${FPS_CONFIG.keys[drill.side > 0 ? 'right' : 'left'].replace(/^Key/, '')} · ${drill.side > 0 ? t.drillRight : t.drillLeft}`;
  byId<HTMLElement>('fpsCoachRound').textContent =
    `${t.drillRound} ${String(drill.round).padStart(2, '0')}`;
  const cue = drill.returnCue;
  byId<HTMLElement>('fpsCoachSide').textContent =
    drill.phase === 'return'
      ? cue.key
        ? `${FPS_CONFIG.keys[cue.key].replace(/^Key/, '')} · ${t.drillSafeDistance} ${cue.distance.toFixed(2)} m`
        : t.drillReturn
      : side;
  sequence(
    byId('fpsCoachSteps'),
    drill.steps.map((key) => t[key as keyof FpsText]),
    drill.stepIndex,
  );
  const hint =
    drill.kind === 'strafe'
      ? drill.phase === 'move'
        ? t.strafeMoveHint
        : drill.ready
          ? t.strafeFireHint
          : t.strafeStopHint
      : drill.phase === 'peek'
        ? t.peekMoveHint
        : drill.phase === 'return'
          ? t.peekReturnHint
          : t.peekFireHint;
  byId<HTMLElement>('fpsCoachHint').textContent = hint.replace('{side}', side);
  const last = drill.last;
  const feedback = byId<HTMLElement>('fpsCoachFeedback');
  feedback.hidden =
    !last || session.time - last.time > FPS_CONFIG.drills.presentation.feedbackSeconds;
  feedback.dataset.result = last?.reason ?? '';
  feedback.textContent = last ? t[REASON_TEXT[last.reason]] : '';
  byId<HTMLProgressElement>('fpsCoachProgress').value = drill.progress;
}
