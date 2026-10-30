// Minimal ITRANS-subset -> Odia Unicode converter.
// Lets us author Odia text in readable transliteration and render proper Odia script.

const VOWELS: Record<string, [string, string]> = {
  // key: [independent form, dependent matra ('' = implicit a)]
  a: ["\u0B05", ""],
  aa: ["\u0B06", "\u0B3E"],
  A: ["\u0B06", "\u0B3E"],
  i: ["\u0B07", "\u0B3F"],
  ii: ["\u0B08", "\u0B40"],
  I: ["\u0B08", "\u0B40"],
  u: ["\u0B09", "\u0B41"],
  uu: ["\u0B0A", "\u0B42"],
  U: ["\u0B0A", "\u0B42"],
  e: ["\u0B0F", "\u0B47"],
  E: ["\u0B0F", "\u0B47"],
  ai: ["\u0B10", "\u0B48"],
  Ai: ["\u0B10", "\u0B48"],
  o: ["\u0B13", "\u0B4B"],
  O: ["\u0B13", "\u0B4B"],
  au: ["\u0B14", "\u0B4C"],
  Au: ["\u0B14", "\u0B4C"],
};

const CONSONANTS: Record<string, string> = {
  k: "\u0B15", K: "\u0B15", kh: "\u0B16", Kh: "\u0B16", g: "\u0B17", G: "\u0B17", gh: "\u0B18", Gh: "\u0B18", ng: "\u0B19",
  ch: "\u0B1A", Ch: "\u0B1A", chh: "\u0B1B", Chh: "\u0B1B", j: "\u0B1C", J: "\u0B1C", jh: "\u0B1D", Jh: "\u0B1D", ny: "\u0B1E", Ny: "\u0B1E",
  T: "\u0B1F", tt: "\u0B1F", Th: "\u0B20", tth: "\u0B20", D: "\u0B21", dd: "\u0B21", Dh: "\u0B22", ddh: "\u0B22", N: "\u0B23", nn: "\u0B23",
  t: "\u0B24", th: "\u0B25", d: "\u0B26", dh: "\u0B27", n: "\u0B28",
  p: "\u0B2A", P: "\u0B2A", ph: "\u0B2B", Ph: "\u0B2B", b: "\u0B2C", B: "\u0B2C", bh: "\u0B2D", Bh: "\u0B2D", m: "\u0B2E", M: "\u0B2E",
  y: "\u0B2F", Y: "\u0B2F", r: "\u0B30", R: "\u0B30", l: "\u0B32", L: "\u0B33", v: "\u0B35", V: "\u0B35", w: "\u0B35", W: "\u0B35",
  sh: "\u0B36", Sh: "\u0B37", s: "\u0B38", S: "\u0B38", h: "\u0B39", H: "\u0B39",
  ksh: "\u0B15\u0B4D\u0B37",
};

const VIRAMA = "\u0B4D";

// English/tech loanwords that must stay in Latin script inside Odia text.
const LATIN_WORDS = new Set([
  "dashboard", "record", "bridge", "smart", "insights", "ai", "pragati", "mitra", "quality", "rework",
  "team", "permissions", "settings", "reports", "csv", "qr", "demo", "mode", "simulated", "status",
  "priority", "deadline", "edit", "delete", "save", "cancel", "add", "create", "view", "search", "filter",
  "back", "close", "refresh", "export", "none", "yes", "no", "note", "submit", "load", "loading", "data",
  "sample", "login", "sign", "in", "out", "up", "account", "email", "password", "phone", "en", "od", "api",
  "excel", "file", "user", "guest", "online", "offline", "ok", "new",
  "confirm", "cancel", "change", "unit", "units", "job", "event", "feeds", "centre", "already", "found",
  "check", "code", "please", "active", "first", "create", "open", "error", "go", "to", "the", "and", "of",
  "on", "in", "is", "as", "at", "by", "an", "we", "you", "your", "it", "this", "that", "will", "be",
  "was", "are", "has", "have", "not", "but", "or", "if", "then", "so", "from", "for", "with", "out", "up",
  "now", "only", "own", "same", "more", "most", "some", "any", "all", "each", "other", "can", "just",
  "should", "do", "does", "did", "over", "under", "again", "than", "too", "very", "add",
  "downtime", "event", "events", "record", "stage", "stages", "inspection", "reject", "maintenance",
  "schedule", "equipment", "affected", "supplier", "delivery", "wear", "tear", "overloading", "manpower",
  "stock", "list", "checker", "workers", "corrective", "track", "rejections", "bottleneck", "minit",
  "minutes", "minutes?", "hours?", "pre-check", "availability", "starting", "discuss", "category",
  "minutes", "verify", "verified", "occasion", "occurrence", "where", "known", "currently", "held",
  "agree", "example", "term", "terms", "possible", "causes", "unverified", "records", "show", "when",
  "happened", "why", "last", "across", "totalling", "reported", "affecting", "linked", "finished",
  "expected", "date", "percent", "machine", "machines", "material", "shortage", "quality", "issue",
  "power", "interruption", "labour", "coordination", "problem", "unavailable", "other", "trend", "order",
  "completion", "repeated", "recurring", "frequently", "delayed", "production", "bottleneck",
]);

function isAlpha(ch: string) {
  return /[A-Za-z]/.test(ch);
}

export function toOdia(text: string): string {
  const tokens = Object.keys({ ...VOWELS, ...CONSONANTS }).sort((a, b) => b.length - a.length);
  let out = "";
  let i = 0;
  let pendingConsonant = ""; // consonant awaiting a vowel decision
  let wordHasLetters = false;

  const flushConsonant = (atWordEnd: boolean) => {
    if (!pendingConsonant) return;
    // At the end of a word, a trailing consonant takes the implicit 'a' (no virama).
    out += pendingConsonant + (atWordEnd ? "" : VIRAMA);
    pendingConsonant = "";
  };

  while (i < text.length) {
    const ch = text[i];
    if (isAlpha(ch)) {
      // Try to read a whole Latin word to check the whitelist.
      let j = i;
      while (j < text.length && isAlpha(text[j])) j++;
      const word = text.slice(i, j);
      if (LATIN_WORDS.has(word.toLowerCase())) {
        flushConsonant(false);
        out += word;
        wordHasLetters = true;
        i = j;
        continue;
      }
      // Match longest token at position i.
      let matched = "";
      for (const t of tokens) {
        if (text.startsWith(t, i)) {
          matched = t;
          break;
        }
      }
      if (!matched) {
        // unknown letter (e.g. 'x', 'q', 'f', 'z') — pass through
        flushConsonant(false);
        out += ch;
        wordHasLetters = true;
        i++;
        continue;
      }
      if (matched in CONSONANTS) {
        flushConsonant(false);
        pendingConsonant = CONSONANTS[matched];
        wordHasLetters = true;
        i += matched.length;
      } else {
        // vowel
        const [ind, matra] = VOWELS[matched];
        if (pendingConsonant) {
          out += pendingConsonant + matra;
          pendingConsonant = "";
        } else {
          out += ind;
        }
        wordHasLetters = true;
        i += matched.length;
      }
      continue;
    }
    // non-letter: word boundary
    flushConsonant(true);
    if (ch >= "0" && ch <= "9") {
      out += String.fromCharCode(0x0B66 + Number(ch));
    } else if (ch === "|") {
      out += "\u0B64";
    } else {
      out += ch;
    }
    i++;
  }
  flushConsonant(true);
  return out;
}

export function mapOdia(obj: Record<string, string>): Record<string, string> {
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) res[k] = toOdia(v);
  return res;
}
