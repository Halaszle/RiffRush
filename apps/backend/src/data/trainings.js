export const seedTrainings = [
  {
    id: "training-001",
    slug: "single-string-timing-foundations",
    title: "Single String Timing Foundations",
    difficulty: "beginner",
    description: "Podstawowy trening jednej struny z naciskiem na timing i rowne wejscia.",
    objective: "Zagrac poprawne dzwieki w rytmie przy stabilnym tempie.",
    tuning: "standard",
    tempoBpm: 80,
    exerciseId: "exercise-001",
    contentGraph: {
      isRoot: true,
      unlocks: ["training-003", "training-004"]
    },
    noteSequence: ["E4", "F4", "G4", "A4"],
    chartSummary: {
      sectionCount: 2,
      restCount: 3,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "intro", label: "Intro pulse", startBeat: 0, lengthBeats: 2 },
        { id: "climb", label: "Ascending phrase", startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "E4", stringNumber: 1, beatOffset: 0, durationBeats: 0.5, sectionId: "intro" },
        { type: "rest", beatOffset: 0.5, durationBeats: 0.5, sectionId: "intro" },
        { type: "target", note: "F4", stringNumber: 1, beatOffset: 1, durationBeats: 0.5, sectionId: "intro" },
        { type: "rest", beatOffset: 1.5, durationBeats: 0.5, sectionId: "intro" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 2, durationBeats: 0.5, sectionId: "climb" },
        { type: "rest", beatOffset: 2.5, durationBeats: 0.5, sectionId: "climb" },
        { type: "target", note: "A4", stringNumber: 1, beatOffset: 3, durationBeats: 1, sectionId: "climb" }
      ]
    },
    targetSequence: [
      { note: "E4", stringNumber: 1, beatOffset: 0, durationBeats: 0.5, sectionId: "intro" },
      { note: "F4", stringNumber: 1, beatOffset: 1, durationBeats: 0.5, sectionId: "intro" },
      { note: "G4", stringNumber: 1, beatOffset: 2, durationBeats: 0.5, sectionId: "climb" },
      { note: "A4", stringNumber: 1, beatOffset: 3, durationBeats: 1, sectionId: "climb" }
    ]
  },
  {
    id: "training-002",
    slug: "alternate-picking-basics",
    title: "Alternate Picking Basics",
    difficulty: "beginner",
    description: "Prosty wzorzec do cwiczenia regularnego kostkowania i trafiania w nuty.",
    objective: "Poprawic powtarzalnosc trafien i zachowanie pulsu.",
    tuning: "standard",
    tempoBpm: 95,
    exerciseId: "exercise-002",
    contentGraph: {
      isRoot: false,
      unlocks: ["training-006", "training-007"]
    },
    noteSequence: ["A3", "B3", "C4", "B3"],
    chartSummary: {
      sectionCount: 2,
      restCount: 0,
      chartLengthBeats: 2
    },
    chart: {
      sections: [
        { id: "pickup", label: "Pickup figure", startBeat: 0, lengthBeats: 1 },
        { id: "answer", label: "Answer phrase", startBeat: 1, lengthBeats: 1 }
      ],
      events: [
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 0, durationBeats: 0.5, sectionId: "pickup" },
        { type: "target", note: "B3", stringNumber: 3, beatOffset: 0.5, durationBeats: 0.5, sectionId: "pickup" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 1, durationBeats: 0.5, sectionId: "answer" },
        { type: "target", note: "B3", stringNumber: 3, beatOffset: 1.5, durationBeats: 0.5, sectionId: "answer" }
      ]
    },
    targetSequence: [
      { note: "A3", stringNumber: 3, beatOffset: 0, durationBeats: 0.5, sectionId: "pickup" },
      { note: "B3", stringNumber: 3, beatOffset: 0.5, durationBeats: 0.5, sectionId: "pickup" },
      { note: "C4", stringNumber: 3, beatOffset: 1, durationBeats: 0.5, sectionId: "answer" },
      { note: "B3", stringNumber: 3, beatOffset: 1.5, durationBeats: 0.5, sectionId: "answer" }
    ]
  },
  {
    id: "training-003",
    slug: "timing-control-ladder",
    title: "Timing Control Ladder",
    difficulty: "intermediate",
    description: "Trening zwiekszajacy precyzje wejsc przy rosnacym tempie.",
    objective: "Utrzymac trafienia mimo zmiany gestosci i tempa.",
    tuning: "standard",
    tempoBpm: 110,
    exerciseId: "exercise-003",
    contentGraph: {
      isRoot: false,
      unlocks: ["training-002", "training-008"]
    },
    noteSequence: ["D4", "E4", "F4", "G4", "A4", "G4"],
    chartSummary: {
      sectionCount: 2,
      restCount: 1,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "ladder-a", label: "Ladder A", startBeat: 0, lengthBeats: 2 },
        { id: "ladder-b", label: "Ladder B", startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 0, durationBeats: 0.5, sectionId: "ladder-a" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "ladder-a" },
        { type: "target", note: "F4", stringNumber: 2, beatOffset: 1, durationBeats: 0.5, sectionId: "ladder-a" },
        { type: "target", note: "G4", stringNumber: 2, beatOffset: 1.5, durationBeats: 0.5, sectionId: "ladder-a" },
        { type: "rest", beatOffset: 2, durationBeats: 0.5, sectionId: "ladder-b" },
        { type: "target", note: "A4", stringNumber: 2, beatOffset: 2.5, durationBeats: 0.5, sectionId: "ladder-b" },
        { type: "target", note: "G4", stringNumber: 2, beatOffset: 3, durationBeats: 1, sectionId: "ladder-b" }
      ]
    },
    targetSequence: [
      { note: "D4", stringNumber: 2, beatOffset: 0, durationBeats: 0.5, sectionId: "ladder-a" },
      { note: "E4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "ladder-a" },
      { note: "F4", stringNumber: 2, beatOffset: 1, durationBeats: 0.5, sectionId: "ladder-a" },
      { note: "G4", stringNumber: 2, beatOffset: 1.5, durationBeats: 0.5, sectionId: "ladder-a" },
      { note: "A4", stringNumber: 2, beatOffset: 2.5, durationBeats: 0.5, sectionId: "ladder-b" },
      { note: "G4", stringNumber: 2, beatOffset: 3, durationBeats: 1, sectionId: "ladder-b" }
    ]
  },
  {
    id: "training-004",
    slug: "first-pentatonic-steps",
    title: "First Pentatonic Steps",
    difficulty: "beginner",
    description: "Wejdz na skale Am pentatonic — cztery nuty w pudelku 1, grane spokojna cwiartkowa.",
    objective: "Wyrobic plynne przejscie miedzy strunami przy zachowaniu stalego pulsu.",
    tuning: "standard",
    tempoBpm: 72,
    exerciseId: "exercise-004",
    contentGraph: {
      isRoot: false,
      unlocks: ["training-005"]
    },
    noteSequence: ["A3", "C4", "D4", "E4"],
    chartSummary: {
      sectionCount: 2,
      restCount: 3,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "roots", label: "Root pair", startBeat: 0, lengthBeats: 2 },
        { id: "climb", label: "Upper pair", startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "roots" },
        { type: "rest",                                 beatOffset: 0.5, durationBeats: 0.5, sectionId: "roots" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "roots" },
        { type: "rest",                                 beatOffset: 1.5, durationBeats: 0.5, sectionId: "roots" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 2,   durationBeats: 0.5, sectionId: "climb" },
        { type: "rest",                                 beatOffset: 2.5, durationBeats: 0.5, sectionId: "climb" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 3,   durationBeats: 1,   sectionId: "climb" }
      ]
    },
    targetSequence: [
      { note: "A3", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "roots" },
      { note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "roots" },
      { note: "D4", stringNumber: 2, beatOffset: 2,   durationBeats: 0.5, sectionId: "climb" },
      { note: "E4", stringNumber: 2, beatOffset: 3,   durationBeats: 1,   sectionId: "climb" }
    ]
  },
  {
    id: "training-005",
    slug: "pentatonic-reverse",
    title: "Pentatonic Reverse",
    difficulty: "beginner",
    description: "Zejdz z Am pentatonic i zakoncz rozwiazaniem na tonice — pelna fraza w dol.",
    objective: "Wyczuc kierunek melodyczny i czystosc wejsc przy gre w dol skali.",
    tuning: "standard",
    tempoBpm: 80,
    exerciseId: "exercise-005",
    contentGraph: {
      isRoot: false,
      unlocks: []
    },
    noteSequence: ["E4", "D4", "C4", "A3", "C4"],
    chartSummary: {
      sectionCount: 2,
      restCount: 0,
      chartLengthBeats: 3
    },
    chart: {
      sections: [
        { id: "descent", label: "Descent", startBeat: 0, lengthBeats: 2 },
        { id: "resolve", label: "Resolve", startBeat: 2, lengthBeats: 1 }
      ],
      events: [
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 0,   durationBeats: 0.5, sectionId: "descent" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "descent" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "descent" },
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 1.5, durationBeats: 0.5, sectionId: "descent" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 2,   durationBeats: 1,   sectionId: "resolve" }
      ]
    },
    targetSequence: [
      { note: "E4", stringNumber: 2, beatOffset: 0,   durationBeats: 0.5, sectionId: "descent" },
      { note: "D4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "descent" },
      { note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "descent" },
      { note: "A3", stringNumber: 3, beatOffset: 1.5, durationBeats: 0.5, sectionId: "descent" },
      { note: "C4", stringNumber: 3, beatOffset: 2,   durationBeats: 1,   sectionId: "resolve" }
    ]
  },
  {
    id: "training-006",
    slug: "major-triad-arpeggio",
    title: "Major Triad Arpeggio",
    difficulty: "intermediate",
    description: "Trójdzwiek C-dur arpegiowany w gore i dol na trzech strunach — czysty skok.",
    objective: "Precyzyjnie trafiac w tony akordowe przy przeskokach miedzy strunami.",
    tuning: "standard",
    tempoBpm: 90,
    exerciseId: "exercise-006",
    contentGraph: {
      isRoot: false,
      unlocks: []
    },
    noteSequence: ["C4", "E4", "G4", "G4", "E4", "C4"],
    chartSummary: {
      sectionCount: 2,
      restCount: 1,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "ascend",  label: "Ascend",  startBeat: 0, lengthBeats: 2 },
        { id: "descend", label: "Descend", startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "ascend" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "ascend" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 1,   durationBeats: 0.5, sectionId: "ascend" },
        { type: "rest",                                 beatOffset: 1.5, durationBeats: 0.5, sectionId: "ascend" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 2,   durationBeats: 0.5, sectionId: "descend" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 2.5, durationBeats: 0.5, sectionId: "descend" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 3,   durationBeats: 1,   sectionId: "descend" }
      ]
    },
    targetSequence: [
      { note: "C4", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "ascend" },
      { note: "E4", stringNumber: 2, beatOffset: 0.5, durationBeats: 0.5, sectionId: "ascend" },
      { note: "G4", stringNumber: 1, beatOffset: 1,   durationBeats: 0.5, sectionId: "ascend" },
      { note: "G4", stringNumber: 1, beatOffset: 2,   durationBeats: 0.5, sectionId: "descend" },
      { note: "E4", stringNumber: 2, beatOffset: 2.5, durationBeats: 0.5, sectionId: "descend" },
      { note: "C4", stringNumber: 3, beatOffset: 3,   durationBeats: 1,   sectionId: "descend" }
    ]
  },
  {
    id: "training-007",
    slug: "low-string-groove",
    title: "Low String Groove",
    difficulty: "intermediate",
    description: "Ruch po korzeniach A-D-E na niskich strunach — klasyczny wzorzec powerchordowy.",
    objective: "Opanowac dolny rejestr gitary i utrzymac groove na strunach 4-5.",
    tuning: "standard",
    tempoBpm: 85,
    exerciseId: "exercise-007",
    contentGraph: {
      isRoot: false,
      unlocks: ["training-009"]
    },
    noteSequence: ["A2", "D3", "E3", "D3", "A2", "E3"],
    chartSummary: {
      sectionCount: 2,
      restCount: 1,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "root", label: "Root groove", startBeat: 0, lengthBeats: 2 },
        { id: "move", label: "Root move",   startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "A2", stringNumber: 5, beatOffset: 0,   durationBeats: 0.5, sectionId: "root" },
        { type: "target", note: "D3", stringNumber: 4, beatOffset: 0.5, durationBeats: 0.5, sectionId: "root" },
        { type: "target", note: "E3", stringNumber: 4, beatOffset: 1,   durationBeats: 0.5, sectionId: "root" },
        { type: "rest",                                 beatOffset: 1.5, durationBeats: 0.5, sectionId: "root" },
        { type: "target", note: "D3", stringNumber: 4, beatOffset: 2,   durationBeats: 0.5, sectionId: "move" },
        { type: "target", note: "A2", stringNumber: 5, beatOffset: 2.5, durationBeats: 0.5, sectionId: "move" },
        { type: "target", note: "E3", stringNumber: 4, beatOffset: 3,   durationBeats: 1,   sectionId: "move" }
      ]
    },
    targetSequence: [
      { note: "A2", stringNumber: 5, beatOffset: 0,   durationBeats: 0.5, sectionId: "root" },
      { note: "D3", stringNumber: 4, beatOffset: 0.5, durationBeats: 0.5, sectionId: "root" },
      { note: "E3", stringNumber: 4, beatOffset: 1,   durationBeats: 0.5, sectionId: "root" },
      { note: "D3", stringNumber: 4, beatOffset: 2,   durationBeats: 0.5, sectionId: "move" },
      { note: "A2", stringNumber: 5, beatOffset: 2.5, durationBeats: 0.5, sectionId: "move" },
      { note: "E3", stringNumber: 4, beatOffset: 3,   durationBeats: 1,   sectionId: "move" }
    ]
  },
  {
    id: "training-008",
    slug: "a-natural-minor-scale",
    title: "A Natural Minor Scale",
    difficulty: "intermediate",
    description: "Pelna skala A naturalnego minor — 8 nut w gore i 7 w dol na trzech strunach.",
    objective: "Zbudowac plynnosc na calej skali i precyzyjne wejscia przy osmych nutach.",
    tuning: "standard",
    tempoBpm: 92,
    exerciseId: "exercise-008",
    contentGraph: {
      isRoot: false,
      unlocks: []
    },
    noteSequence: ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "G4", "F4", "E4", "D4", "C4", "B3", "A3"],
    chartSummary: {
      sectionCount: 2,
      restCount: 0,
      chartLengthBeats: 8
    },
    chart: {
      sections: [
        { id: "scale-up",   label: "Scale up",   startBeat: 0, lengthBeats: 4 },
        { id: "scale-down", label: "Scale down", startBeat: 4, lengthBeats: 4 }
      ],
      events: [
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "B3", stringNumber: 3, beatOffset: 0.5, durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 1.5, durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 2,   durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "F4", stringNumber: 1, beatOffset: 2.5, durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 3,   durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "A4", stringNumber: 1, beatOffset: 3.5, durationBeats: 0.5, sectionId: "scale-up" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 4,   durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "F4", stringNumber: 1, beatOffset: 4.5, durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 5,   durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 5.5, durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 6,   durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "B3", stringNumber: 3, beatOffset: 6.5, durationBeats: 0.5, sectionId: "scale-down" },
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 7,   durationBeats: 1,   sectionId: "scale-down" }
      ]
    },
    targetSequence: [
      { note: "A3", stringNumber: 3, beatOffset: 0,   durationBeats: 0.5, sectionId: "scale-up" },
      { note: "B3", stringNumber: 3, beatOffset: 0.5, durationBeats: 0.5, sectionId: "scale-up" },
      { note: "C4", stringNumber: 3, beatOffset: 1,   durationBeats: 0.5, sectionId: "scale-up" },
      { note: "D4", stringNumber: 2, beatOffset: 1.5, durationBeats: 0.5, sectionId: "scale-up" },
      { note: "E4", stringNumber: 2, beatOffset: 2,   durationBeats: 0.5, sectionId: "scale-up" },
      { note: "F4", stringNumber: 1, beatOffset: 2.5, durationBeats: 0.5, sectionId: "scale-up" },
      { note: "G4", stringNumber: 1, beatOffset: 3,   durationBeats: 0.5, sectionId: "scale-up" },
      { note: "A4", stringNumber: 1, beatOffset: 3.5, durationBeats: 0.5, sectionId: "scale-up" },
      { note: "G4", stringNumber: 1, beatOffset: 4,   durationBeats: 0.5, sectionId: "scale-down" },
      { note: "F4", stringNumber: 1, beatOffset: 4.5, durationBeats: 0.5, sectionId: "scale-down" },
      { note: "E4", stringNumber: 2, beatOffset: 5,   durationBeats: 0.5, sectionId: "scale-down" },
      { note: "D4", stringNumber: 2, beatOffset: 5.5, durationBeats: 0.5, sectionId: "scale-down" },
      { note: "C4", stringNumber: 3, beatOffset: 6,   durationBeats: 0.5, sectionId: "scale-down" },
      { note: "B3", stringNumber: 3, beatOffset: 6.5, durationBeats: 0.5, sectionId: "scale-down" },
      { note: "A3", stringNumber: 3, beatOffset: 7,   durationBeats: 1,   sectionId: "scale-down" }
    ]
  },
  {
    id: "training-009",
    slug: "pentatonic-speed-run",
    title: "Pentatonic Speed Run",
    difficulty: "advanced",
    description: "Am pentatonic szesnastkowy burst w gore i dol — test szybkosci i precyzji.",
    objective: "Zagrac 12 nut szesnastkowych z czystym atakfm i trafnymi wejsciami.",
    tuning: "standard",
    tempoBpm: 130,
    exerciseId: "exercise-009",
    contentGraph: {
      isRoot: false,
      unlocks: []
    },
    noteSequence: ["A3", "C4", "D4", "E4", "G4", "A4", "A4", "G4", "E4", "D4", "C4", "A3"],
    chartSummary: {
      sectionCount: 2,
      restCount: 1,
      chartLengthBeats: 4
    },
    chart: {
      sections: [
        { id: "burst-up",   label: "Burst up",   startBeat: 0, lengthBeats: 2 },
        { id: "burst-down", label: "Burst down", startBeat: 2, lengthBeats: 2 }
      ],
      events: [
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 0,    durationBeats: 0.25, sectionId: "burst-up" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 0.25, durationBeats: 0.25, sectionId: "burst-up" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 0.5,  durationBeats: 0.25, sectionId: "burst-up" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 0.75, durationBeats: 0.25, sectionId: "burst-up" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 1,    durationBeats: 0.25, sectionId: "burst-up" },
        { type: "target", note: "A4", stringNumber: 1, beatOffset: 1.25, durationBeats: 0.25, sectionId: "burst-up" },
        { type: "rest",                                 beatOffset: 1.5,  durationBeats: 0.5,  sectionId: "burst-up" },
        { type: "target", note: "A4", stringNumber: 1, beatOffset: 2,    durationBeats: 0.25, sectionId: "burst-down" },
        { type: "target", note: "G4", stringNumber: 1, beatOffset: 2.25, durationBeats: 0.25, sectionId: "burst-down" },
        { type: "target", note: "E4", stringNumber: 2, beatOffset: 2.5,  durationBeats: 0.25, sectionId: "burst-down" },
        { type: "target", note: "D4", stringNumber: 2, beatOffset: 2.75, durationBeats: 0.25, sectionId: "burst-down" },
        { type: "target", note: "C4", stringNumber: 3, beatOffset: 3,    durationBeats: 0.25, sectionId: "burst-down" },
        { type: "target", note: "A3", stringNumber: 3, beatOffset: 3.25, durationBeats: 0.75, sectionId: "burst-down" }
      ]
    },
    targetSequence: [
      { note: "A3", stringNumber: 3, beatOffset: 0,    durationBeats: 0.25, sectionId: "burst-up" },
      { note: "C4", stringNumber: 3, beatOffset: 0.25, durationBeats: 0.25, sectionId: "burst-up" },
      { note: "D4", stringNumber: 2, beatOffset: 0.5,  durationBeats: 0.25, sectionId: "burst-up" },
      { note: "E4", stringNumber: 2, beatOffset: 0.75, durationBeats: 0.25, sectionId: "burst-up" },
      { note: "G4", stringNumber: 1, beatOffset: 1,    durationBeats: 0.25, sectionId: "burst-up" },
      { note: "A4", stringNumber: 1, beatOffset: 1.25, durationBeats: 0.25, sectionId: "burst-up" },
      { note: "A4", stringNumber: 1, beatOffset: 2,    durationBeats: 0.25, sectionId: "burst-down" },
      { note: "G4", stringNumber: 1, beatOffset: 2.25, durationBeats: 0.25, sectionId: "burst-down" },
      { note: "E4", stringNumber: 2, beatOffset: 2.5,  durationBeats: 0.25, sectionId: "burst-down" },
      { note: "D4", stringNumber: 2, beatOffset: 2.75, durationBeats: 0.25, sectionId: "burst-down" },
      { note: "C4", stringNumber: 3, beatOffset: 3,    durationBeats: 0.25, sectionId: "burst-down" },
      { note: "A3", stringNumber: 3, beatOffset: 3.25, durationBeats: 0.75, sectionId: "burst-down" }
    ]
  }
];
