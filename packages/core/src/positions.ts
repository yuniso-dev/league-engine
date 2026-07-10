// EA position normalisation. The EA API reports where each player lined up,
// but the format varies by endpoint: full words ("midfielder"), short codes
// ("att", "gk", "cb") or numeric posIds ("25" = ST). The site's canonical
// vocabulary is the four buckets below — normalise every EA value into them
// so labels, the admin stats editor and TOTT bucketing all agree.

export type PositionBucket = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';

export const POSITION_BUCKETS: PositionBucket[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];

/** Short display label per bucket — GK / DEF / MID / FWD. */
export const POSITION_BUCKET_LABEL: Record<PositionBucket, string> = {
  goalkeeper: 'GK',
  defender: 'DEF',
  midfielder: 'MID',
  forward: 'FWD',
};

const WORDS: Record<string, PositionBucket> = {
  // goalkeeper
  gk: 'goalkeeper', goalkeeper: 'goalkeeper',
  // defender
  def: 'defender', defender: 'defender', defence: 'defender', defense: 'defender',
  cb: 'defender', lcb: 'defender', rcb: 'defender', lb: 'defender', rb: 'defender',
  lwb: 'defender', rwb: 'defender', fb: 'defender', sw: 'defender',
  // midfielder
  mid: 'midfielder', midfielder: 'midfielder',
  cm: 'midfielder', cdm: 'midfielder', cam: 'midfielder', dm: 'midfielder', am: 'midfielder',
  lm: 'midfielder', rm: 'midfielder', lcm: 'midfielder', rcm: 'midfielder',
  ldm: 'midfielder', rdm: 'midfielder', lam: 'midfielder', ram: 'midfielder',
  // forward
  att: 'forward', attacker: 'forward', forward: 'forward', fwd: 'forward', striker: 'forward',
  st: 'forward', cf: 'forward', lw: 'forward', rw: 'forward',
  lf: 'forward', rf: 'forward', ls: 'forward', rs: 'forward',
};

/** Some EA endpoints send the numeric posId table instead of a name:
 *  0 = GK, 1–8 = the back line (SW/RWB/RB/CBs/LB/LWB), 9–19 = midfield
 *  (DMs/CMs/wide mids/AMs), 20–27 = the front line (Fs/wingers/STs). */
function fromPosId(id: number): PositionBucket | null {
  if (id === 0) return 'goalkeeper';
  if (id >= 1 && id <= 8) return 'defender';
  if (id >= 9 && id <= 19) return 'midfielder';
  if (id >= 20 && id <= 27) return 'forward';
  return null;
}

/** EA position value (any format) → canonical bucket, or null when unknown. */
export function normalizePosition(raw: string | null | undefined): PositionBucket | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return fromPosId(parseInt(s, 10));
  return WORDS[s] ?? null;
}
