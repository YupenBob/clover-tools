import type { Lang } from './i18n';

export type Unit = { id: string; name: string; factor?: number; offset?: number };
export type UnitCategory = 'length' | 'weight' | 'temperature' | 'storage' | 'time' | 'area';

/** Factors are common to every language; names preserve existing translations. */
const definitions: Record<UnitCategory, Omit<Unit, 'name'>[]> = {
  length: [
    {
      id: 'mm',
      factor: 0.001,
    },
    {
      id: 'cm',
      factor: 0.01,
    },
    {
      id: 'm',
      factor: 1,
    },
    {
      id: 'km',
      factor: 1000,
    },
    {
      id: 'in',
      factor: 0.0254,
    },
    {
      id: 'ft',
      factor: 0.3048,
    },
    {
      id: 'yd',
      factor: 0.9144,
    },
    {
      id: 'mi',
      factor: 1609.344,
    },
  ],
  weight: [
    {
      id: 'mg',
      factor: 0.000001,
    },
    {
      id: 'g',
      factor: 0.001,
    },
    {
      id: 'kg',
      factor: 1,
    },
    {
      id: 't',
      factor: 1000,
    },
    {
      id: 'oz',
      factor: 0.028349523125,
    },
    {
      id: 'lb',
      factor: 0.45359237,
    },
    {
      id: 'jin',
      factor: 0.5,
    },
  ],
  temperature: [
    {
      id: 'c',
    },
    {
      id: 'f',
    },
    {
      id: 'k',
    },
  ],
  storage: [
    {
      id: 'b',
      factor: 1,
    },
    {
      id: 'kb',
      factor: 1024,
    },
    {
      id: 'mb',
      factor: 1048576,
    },
    {
      id: 'gb',
      factor: 1073741824,
    },
    {
      id: 'tb',
      factor: 1099511627776,
    },
    {
      id: 'pb',
      factor: 1125899906842624,
    },
  ],
  time: [
    {
      id: 'ms',
      factor: 0.001,
    },
    {
      id: 's',
      factor: 1,
    },
    {
      id: 'min',
      factor: 60,
    },
    {
      id: 'h',
      factor: 3600,
    },
    {
      id: 'd',
      factor: 86400,
    },
    {
      id: 'w',
      factor: 604800,
    },
    {
      id: 'mo',
      factor: 2592000,
    },
    {
      id: 'y',
      factor: 31536000,
    },
  ],
  area: [
    {
      id: 'm2',
      factor: 1,
    },
    {
      id: 'km2',
      factor: 1000000,
    },
    {
      id: 'mu',
      factor: 666.6667,
    },
    {
      id: 'ha',
      factor: 10000,
    },
    {
      id: 'ft2',
      factor: 0.09290304,
    },
  ],
};

const names: Record<Lang, Record<UnitCategory, string[]>> = {
  zh: {
    length: ['毫米', '厘米', '米', '千米', '英寸', '英尺', '码', '英里'],
    weight: ['毫克', '克', '千克', '吨', '盎司', '磅', '斤'],
    temperature: ['摄氏度 (°C)', '华氏度 (°F)', '开尔文 (K)'],
    storage: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    time: ['毫秒', '秒', '分钟', '小时', '天', '周', '月（30天）', '年（365天）'],
    area: ['平方米', '平方千米', '亩', '公顷', '平方英尺'],
  },
  tw: {
    length: ['毫米', '厘米', '米', '千米', '英寸', '英尺', '碼', '英裏'],
    weight: ['毫克', '克', '千克', '噸', '盎司', '磅', '斤'],
    temperature: ['攝氏度 (°C)', '華氏度 (°F)', '開爾文 (K)'],
    storage: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    time: ['毫秒', '秒', '分鐘', '小時', '天', '周', '月（30天）', '年（365天）'],
    area: ['平方米', '平方千米', '畝', '公頃', '平方英尺'],
  },
  en: {
    length: [
      'Millimeters',
      'Centimeters',
      'Meters',
      'Kilometers',
      'Inches',
      'Feet',
      'Yards',
      'Miles',
    ],
    weight: ['Milligrams', 'Grams', 'Kilograms', 'Metric Tons', 'Ounces', 'Pounds', 'Jin'],
    temperature: ['Celsius (°C)', 'Fahrenheit (°F)', 'Kelvin (K)'],
    storage: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    time: [
      'Milliseconds',
      'Seconds',
      'Minutes',
      'Hours',
      'Days',
      'Weeks',
      'Months (30 days)',
      'Years (365 days)',
    ],
    area: ['Square Meters', 'Square Kilometers', 'Chinese Mu', 'Hectares', 'Square Feet'],
  },
  ko: {
    length: ['밀리미터', '센티미터', '미터', '킬로미터', '인치', '피트', '야드', '마일'],
    weight: ['밀리그램', '그램', '킬로그램', '톤', '온스', '파운드', '근(중국)'],
    temperature: ['섭씨 (°C)', '화씨 (°F)', '켈빈 (K)'],
    storage: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    time: ['밀리초', '초', '분', '시간', '일', '주', '월 (30일)', '년 (365일)'],
    area: ['제곱미터', '제곱킬로미터', '무(중국)', '헥타르', '제곱피트'],
  },
  ja: {
    length: [
      'ミリメートル',
      'センチメートル',
      'メートル',
      'キロメートル',
      'インチ',
      'フィート',
      'ヤード',
      'マイル',
    ],
    weight: ['ミリグラム', 'グラム', 'キログラム', 'トン', 'オンス', 'ポンド', '斤（中国）'],
    temperature: ['摂氏 (°C)', '華氏 (°F)', 'ケルビン (K)'],
    storage: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    time: ['ミリ秒', '秒', '分', '時間', '日', '週', '月（30日）', '年（365日）'],
    area: ['平方メートル', '平方キロメートル', 'ムー', 'ヘクタール', '平方フィート'],
  },
};

export const UNIT_DATA = Object.fromEntries(
  Object.entries(names).map(([lang, labels]) => [
    lang,
    Object.fromEntries(
      Object.entries(definitions).map(([category, units]) => [
        category,
        units.map((unit, index) => ({ ...unit, name: labels[category as UnitCategory][index] })),
      ]),
    ),
  ]),
) as Record<Lang, Record<UnitCategory, Unit[]>>;
