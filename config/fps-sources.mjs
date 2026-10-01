/** Data refresh is explicit; neither a build nor a training session fetches game data. */
export const FPS_SOURCES = {
  cs2: {
    version: '2000919',
    revision: 'ce2a2deb0cba2f7e8443901690c0abdb5191b7ab',
    weapons:
      'https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/ce2a2deb0cba2f7e8443901690c0abdb5191b7ab/game/csgo/pak01_dir/scripts/weapons.vdata',
    convars:
      'https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/ce2a2deb0cba2f7e8443901690c0abdb5191b7ab/DumpSource2/convars.txt',
    selected: { ak47: 'weapon_ak47', m4a1s: 'weapon_m4a1_silencer' },
    fields: [
      'm_nDamage',
      'm_iMaxClip1',
      'm_flCycleTime',
      'm_flMaxSpeed',
      'm_flSpread',
      'm_flInaccuracyStand',
      'm_flInaccuracyCrouch',
      'm_flInaccuracyMove',
      'm_flRecoveryTimeStand',
      'm_flRecoveryTimeCrouch',
      'm_flHeadshotMultiplier',
      'm_flArmorRatio',
      'm_flRangeModifier',
      'm_flDisallowAttackAfterReloadStartDuration',
      'm_nRecoilSeed',
    ],
    variables: ['m_yaw', 'm_pitch', 'sv_accelerate', 'sv_friction', 'sv_stopspeed'],
  },
  valorant: {
    version: '13.06.00.5590001',
    weapons: 'https://valorant-api.com/v1/weapons?language=en-US',
    versionUrl: 'https://valorant-api.com/v1/version',
    selected: ['Vandal', 'Phantom'],
    official: 'https://playvalorant.com/en-us/arsenal/',
  },
};
