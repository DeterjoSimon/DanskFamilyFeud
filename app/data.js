// Questions and the answers collected before the app existed.
// Gender codes: "W" = woman answering, "M" = man answering.

export const QUESTIONS = [
  {
    id: 1,
    short: "Best place to go out",
    text: { W: "Best place to go out in the city?", M: "Best place to go out in the city?" },
    da: { W: "Hvor er det bedste sted at gå i byen?", M: "Hvor er det bedste sted at gå i byen?" },
  },
  {
    id: 2,
    short: "Biggest ick",
    text: { W: "What is your biggest ick with a guy?", M: "What is your biggest ick with a girl?" },
    da: { W: "Hvad er dit største ick ved en fyr?", M: "Hvad er dit største ick ved en pige?" },
  },
  {
    id: 3,
    short: "Weirdest place for sex",
    text: { W: "Weirdest place you have had sex?", M: "Weirdest place you have had sex?" },
    da: { W: "Hvad er det mærkeligste sted, du har haft sex?", M: "Hvad er det mærkeligste sted, du har haft sex?" },
  },
  {
    id: 4,
    short: "Most attractive hobby",
    text: { W: "What is the most attractive hobby with a guy?", M: "What is the most attractive hobby with a girl?" },
    da: { W: "Hvad er den mest attraktive hobby hos en fyr?", M: "Hvad er den mest attraktive hobby hos en pige?" },
  },
  {
    id: 5,
    short: "Least attractive first-date drink",
    text: {
      W: "What is the least attractive drink a person can order on a first date?",
      M: "What is the least attractive drink a person can order on a first date?",
    },
    da: {
      W: "Hvad er den mindst attraktive drink, man kan bestille på en første date?",
      M: "Hvad er den mindst attraktive drink, man kan bestille på en første date?",
    },
  },
  {
    id: 6,
    short: "Worst thing after first-time sex",
    text: {
      W: "Worst thing somebody can do after first time sex?",
      M: "Worst thing somebody can do after first time sex?",
    },
    da: {
      W: "Hvad er det værste, man kan gøre efter første gang, man har sex?",
      M: "Hvad er det værste, man kan gøre efter første gang, man har sex?",
    },
  },
];

// "x4" in the original notes means four people gave that answer.
const SEED = {
  1: {
    W: ["Bar leanowski", "Gay bar", "Bootleggers Bar", "Zefside", "Bloom", "Kisme"],
    M: ["Kollegiefest", "Bar", "Bodega Danza"],
  },
  2: {
    W: ["Arrogance", "Arrogance", "Ikke behandler folk ordentligt", "Manipulerende", "Unhygienic", "Kræsen", "Nærrighed"],
    M: ["Social media influencer", "Social media influencer", "Astrologi", "Uhøflig"],
  },
  3: {
    W: ["Folkeskole toiletter", "Ingen", "Busskur", "Børnelegeplads om dagen"],
    M: ["LA Bar toiletter", "Børnelegeplads om natten", "Amalienborg", "Utørret flod"],
  },
  4: {
    W: ["Sport x4", "Read x2", "Brætspil"],
    M: ["Musik x2", "Madlavning", "Danse"],
  },
  5: {
    W: ["Strawberry Daiquiri", "Cosmopolitan", "Whiskey raw", "Skinny bitch med tequila", "Isbjørn", "Rum cola", "Sjus"],
    M: ["Vodka redbull", "Dark n stormy", "Skinny bitch", "Sjus"],
  },
  6: {
    W: ["Gem kondomer", "Gå direkte i bad", "Hiver telefonen", "Dip & dip"],
    M: ["Dip & dip", "Kaste op", "At se skuffet ud x2"],
  },
};

const SEED_TS = "2026-11-01T12:00:00.000Z";

export function seedAnswers() {
  const out = [];
  for (const [q, byGender] of Object.entries(SEED)) {
    for (const [g, list] of Object.entries(byGender)) {
      for (const raw of list) {
        const m = raw.match(/^(.*?)\s+x(\d+)$/i);
        const text = m ? m[1] : raw;
        const n = m ? Number(m[2]) : 1;
        for (let i = 0; i < n; i++) {
          out.push({ id: `seed-${q}-${g}-${out.length}`, q: Number(q), g, text, rid: null, ts: SEED_TS });
        }
      }
    }
  }
  return out;
}
