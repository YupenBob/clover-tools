/** Original preference prompts for entertainment; no licensed questionnaire or diagnostic scoring. */
export const PERSONALITY_AXES = ["EI", "SN", "TF", "JP"] as const;
export type PersonalityAxis = (typeof PERSONALITY_AXES)[number];
export const QUESTION_RULES: { axis: PersonalityAxis; sign: 1 | -1 }[] = [
  { axis: "EI", sign: 1 },
  { axis: "SN", sign: 1 },
  { axis: "TF", sign: 1 },
  { axis: "JP", sign: 1 },
  { axis: "EI", sign: -1 },
  { axis: "SN", sign: -1 },
  { axis: "TF", sign: -1 },
  { axis: "JP", sign: -1 },
  { axis: "EI", sign: 1 },
  { axis: "SN", sign: -1 },
  { axis: "TF", sign: -1 },
  { axis: "JP", sign: 1 },
  { axis: "EI", sign: -1 },
  { axis: "SN", sign: 1 },
  { axis: "TF", sign: 1 },
  { axis: "JP", sign: -1 },
  { axis: "EI", sign: 1 },
  { axis: "SN", sign: 1 },
  { axis: "TF", sign: -1 },
  { axis: "JP", sign: -1 },
  { axis: "EI", sign: -1 },
  { axis: "SN", sign: -1 },
  { axis: "TF", sign: 1 },
  { axis: "JP", sign: 1 },
];
export interface PersonalityResult {
  code: string;
  axes: {
    axis: PersonalityAxis;
    score: number;
    left: number;
    right: number;
    letter: string;
  }[];
}
export function scorePersonality(
  answers: readonly (number | null)[],
): PersonalityResult {
  if (
    answers.length !== QUESTION_RULES.length ||
    Array.from(answers).some(
      (answer) =>
        answer === null || !Number.isInteger(answer) || Math.abs(answer) > 2,
    )
  )
    throw new RangeError("answers");
  const axes = PERSONALITY_AXES.map((axis) => {
    let score = 0,
      count = 0;
    QUESTION_RULES.forEach((rule, i) => {
      if (rule.axis === axis) {
        score += answers[i]! * rule.sign;
        count++;
      }
    });
    const left = Math.round(50 + (score / (count * 2)) * 50);
    return {
      axis,
      score,
      left,
      right: 100 - left,
      letter: score > 0 ? axis[0] : score < 0 ? axis[1] : "X",
    };
  });
  return { code: axes.map((axis) => axis.letter).join(""), axes };
}
