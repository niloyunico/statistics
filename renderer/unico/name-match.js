/* UNICO — the ONE person-name comparison rule.
   Shared by the server (server/h360/staff-match.js for H360 Check, server/bnmc-verify.js before a
   BNMC verification is stored) and the browser (window.UNICO_NAME: the BNMC check on the staff
   form / profile, the "BNMC name differs" badges), so every screen judges two names alike.

   nameScore(a, b) 0..1: word by word (order and a missing middle name matter little), honorifics
   (Md., Mst. ...) dropped, sound-alike spellings folded (Afroza/Afroja), common family names
   (Akter, Begum ...) weighted down, and a word only counts when spelt nearly the same
   ("Rina" is not "Runa"). >= SAME_NAME: the same name; < SIMILAR_NAME: a different person. */
(function (root) {
// Honorifics and spellings that differ between the two systems without being a different name.
const DROP = new Set(['md', 'mst', 'most', 'mosammat', 'mosammad', 'mossammat', 'mosa', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'sk', 'sheikh', 'shaikh', 'mrs', 'mr', 'miss', 'ms', 'dr']);
const SOUND = [[/ph/g, 'f'], [/z/g, 'j'], [/w/g, 'o'], [/ee/g, 'i'], [/oo/g, 'u'], [/th/g, 't'], [/kh/g, 'k'], [/gh/g, 'g'], [/sh/g, 's'], [/y/g, 'i'], [/(.)\1+/g, '$1']];
function nameTokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t && !DROP.has(t));
}
const sound = (token) => SOUND.reduce((t, [re, to]) => t.replace(re, to), token);

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const ratio = (a, b) => (!a && !b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length));

// Family names half the staff share: agreeing on "Akter" says little about being the same person.
const COMMON = new Set(['akter', 'aktar', 'akhter', 'akther', 'khatun', 'khatoon', 'begum', 'islam', 'hossain', 'hosen', 'hossen', 'hussain', 'rahman', 'sultana', 'khan', 'das', 'roy', 'sarkar', 'sorkar', 'mondal', 'mia', 'miah', 'uddin', 'ahmed', 'ahmad', 'nesa', 'nessa', 'jahan', 'parvin', 'parveen', 'bibi', 'chowdhury', 'biswas', 'haque', 'hoque', 'alam', 'kabir', 'rani', 'bala', 'kumar']
  .map(sound));
const weight = (t) => (COMMON.has(t) ? 0.3 : 1);
// A word counts as the same word only when it is spelt nearly the same ("Rina" is not "Runa").
// Bangla names are written in English with free vowels: "Marium" / "Moriom", "Roushan" / "Roshni".
// Longer words (5+ letters) whose consonants agree count as the same word; short ones do not
// ("Rina" is still not "Runa").
const skeleton = (t) => t.replace(/[aeiou]/g, '');
const sameWord = (t, u) => {
  const r = ratio(t, u);
  if (r >= 0.8) return r;
  if (t.length >= 5 && u.length >= 5 && skeleton(t).length >= 2 && skeleton(t) === skeleton(u)) return 0.85;
  return 0;
};

// 0..1: how likely the two names are the same person's. Word by word (order and a
// missing middle name matter little), sound-alike spellings folded, common family
// names weighted down.
function nameScore(a, b) {
  const A = nameTokens(a).map(sound), B = nameTokens(b).map(sound);
  if (!A.length || !B.length) return 0;
  const side = (X, Y) => {
    let got = 0, of = 0;
    for (const t of X) { const w = weight(t); of += w; got += w * Math.max(...Y.map((u) => sameWord(t, u))); }
    return of ? got / of : 0;
  };
  const fromA = side(A, B), fromB = side(B, A);
  // The shorter name wholly inside the longer one ("Ashraf Ali" / "Md. Ashraf Ali Munna"),
  // provided it has a given name of its own, not just "Akter".
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  const shortFits = short.some((t) => !COMMON.has(t)) && side(short, long) >= 0.9;
  return Math.max((fromA + fromB) / 2, shortFits ? 0.86 : 0);
}
const SAME_NAME = 0.84;     // the same name, perhaps spelt differently
const SIMILAR_NAME = 0.55;  // under this: a different person


  // Two names written the same: case, dots, commas and extra spaces aside.
  const normName = (v) => String(v || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  // A stored BNMC verification against the record it sits on: 'ok', 'mismatch' (the council's
  // registrant is somebody else by name) or null (nothing to compare). A person confirmed the
  // match ("same person") -> 'ok'.
  function bnmcNameState(rec, v) {
    const theirs = v && v.person && v.person.name;
    if (!rec || !theirs || !String(rec.name || '').trim()) return null;
    if (v.confirmed) return 'ok';
    return nameScore(rec.name, theirs) >= SIMILAR_NAME ? 'ok' : 'mismatch';
  }

  const API = { nameTokens: nameTokens, nameScore: nameScore, normName: normName, bnmcNameState: bnmcNameState, SAME_NAME: SAME_NAME, SIMILAR_NAME: SIMILAR_NAME, COMMON: COMMON };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_NAME = API;
})(typeof window !== 'undefined' ? window : null);
