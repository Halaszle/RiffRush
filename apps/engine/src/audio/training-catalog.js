const DEFAULT_TEMPO_BPM = 96;
const DEFAULT_LEAD_IN_BEATS = 1;

export const exerciseCatalog = {
  "exercise-001": {
    defaultTempoBpm: 80,
    leadInBeats: 1,
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
  "exercise-002": {
    defaultTempoBpm: 95,
    leadInBeats: 1,
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
  "exercise-003": {
    defaultTempoBpm: 110,
    leadInBeats: 1,
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

  // ── New exercises ──────────────────────────────────────────────────────────

  // Am pentatonic box 1 — ascending, slow quarter notes. Introduces multi-string
  // position playing with deliberate spacing between each note.
  "exercise-004": {
    defaultTempoBpm: 72,
    leadInBeats: 1,
    sections: [
      { id: "roots",  label: "Root pair",  startBeat: 0, lengthBeats: 2 },
      { id: "climb",  label: "Upper pair", startBeat: 2, lengthBeats: 2 }
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

  // Am pentatonic box 1 — descending then resolve. Pairs with exercise-004 to
  // build the complete up-and-back movement across the box.
  "exercise-005": {
    defaultTempoBpm: 80,
    leadInBeats: 1,
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

  // C major triad arpeggio — ascending then descending. Trains hearing chord
  // tones and precise cross-string jumping.
  "exercise-006": {
    defaultTempoBpm: 90,
    leadInBeats: 1,
    sections: [
      { id: "ascend", label: "Ascend", startBeat: 0, lengthBeats: 2 },
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

  // Low-string root movement — A, D, E roots on strings 4-5. Introduces the
  // lower register of the guitar and the classic power-chord root pattern.
  "exercise-007": {
    defaultTempoBpm: 85,
    leadInBeats: 1,
    sections: [
      { id: "root",  label: "Root groove", startBeat: 0, lengthBeats: 2 },
      { id: "move",  label: "Root move",   startBeat: 2, lengthBeats: 2 }
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

  // A natural minor scale — full 8-note run ascending then descending. Builds
  // finger independence and scale knowledge across three strings.
  "exercise-008": {
    defaultTempoBpm: 92,
    leadInBeats: 1,
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

  // Am pentatonic box 1 — fast 16th-note burst up then down. Tests speed,
  // accuracy and clean release at an advanced tempo.
  "exercise-009": {
    defaultTempoBpm: 130,
    leadInBeats: 1,
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
  }
};

function getFallbackDefinition() {
  return {
    defaultTempoBpm: DEFAULT_TEMPO_BPM,
    leadInBeats: DEFAULT_LEAD_IN_BEATS,
    sections: [
      { id: "main", label: "Main", startBeat: 0, lengthBeats: 3 }
    ],
    events: [
      { type: "target", note: "E4", stringNumber: 1, beatOffset: 0, durationBeats: 0.5, sectionId: "main" },
      { type: "target", note: "G4", stringNumber: 1, beatOffset: 1, durationBeats: 0.5, sectionId: "main" },
      { type: "target", note: "A4", stringNumber: 1, beatOffset: 2, durationBeats: 1, sectionId: "main" }
    ]
  };
}

function buildSectionLookup(sections = []) {
  return new Map(sections.map((section) => [section.id, section]));
}

function calculateChartLengthBeats(events = []) {
  return events.reduce(
    (longestBeat, event) => Math.max(longestBeat, event.beatOffset + event.durationBeats),
    0
  );
}

export function getExerciseChart(exerciseId) {
  const definition = exerciseCatalog[exerciseId] ?? getFallbackDefinition();
  const chartLengthBeats = calculateChartLengthBeats(definition.events);
  const restCount = definition.events.filter((event) => event.type === "rest").length;
  const targetCount = definition.events.filter((event) => event.type === "target").length;

  return {
    sections: definition.sections.map((section) => ({ ...section })),
    events: definition.events.map((event) => ({ ...event })),
    chartLengthBeats,
    restCount,
    targetCount
  };
}

export function getExerciseSchedule(exerciseId, options = {}) {
  const definition = exerciseCatalog[exerciseId] ?? getFallbackDefinition();
  const tempoBpm = options.tempoBpm ?? definition.defaultTempoBpm ?? DEFAULT_TEMPO_BPM;
  const selectedSection = options.loopSectionId
    ? definition.sections.find((section) => section.id === options.loopSectionId) ?? null
    : null;
  const practiceScope = selectedSection ? "section-loop" : "full-chart";
  const loopRepetitionCount =
    practiceScope === "section-loop"
      ? Math.max(1, Math.min(6, Math.round(options.loopRepetitionCount ?? 1)))
      : 1;
  const loopTempoStepBpm =
    practiceScope === "section-loop"
      ? Math.max(0, Math.min(16, Math.round(options.loopTempoStepBpm ?? 0)))
      : 0;
  const sectionStartBeat = selectedSection?.startBeat ?? 0;
  const filteredSections = selectedSection
    ? [
        {
          ...selectedSection,
          startBeat: 0
        }
      ]
    : definition.sections;
  const filteredEvents = definition.events
    .filter((event) => !selectedSection || event.sectionId === selectedSection.id)
    .map((event) => ({
      ...event,
      beatOffset: Number((event.beatOffset - sectionStartBeat).toFixed(2))
    }));
  const beatDurationMs = 60000 / tempoBpm;
  const leadInBeats = definition.leadInBeats ?? DEFAULT_LEAD_IN_BEATS;
  const leadInMs = leadInBeats * beatDurationMs;
  const sectionLookup = buildSectionLookup(filteredSections);
  const sectionLengthBeats = selectedSection?.lengthBeats ?? calculateChartLengthBeats(filteredEvents);
  const practiceRepetitions = [];
  const events = [];
  let currentStartMs = Math.round(leadInMs);
  let nextEventIndex = 0;

  for (let repetitionIndex = 0; repetitionIndex < loopRepetitionCount; repetitionIndex += 1) {
    const repetitionTempoBpm = tempoBpm + repetitionIndex * loopTempoStepBpm;
    const repetitionBeatDurationMs = 60000 / repetitionTempoBpm;
    const repetitionDurationMs = Math.round(sectionLengthBeats * repetitionBeatDurationMs);

    practiceRepetitions.push({
      repetitionIndex,
      tempoBpm: repetitionTempoBpm,
      startTimeMs: currentStartMs,
      durationMs: repetitionDurationMs
    });

    for (const event of filteredEvents) {
      events.push({
        index: nextEventIndex,
        type: event.type,
        beatOffset: event.beatOffset,
        durationBeats: event.durationBeats,
        expectedTimeMs: Math.round(currentStartMs + event.beatOffset * repetitionBeatDurationMs),
        durationMs: Math.round(event.durationBeats * repetitionBeatDurationMs),
        sectionId: event.sectionId,
        sectionLabel: sectionLookup.get(event.sectionId)?.label ?? event.sectionId,
        repetitionIndex,
        repetitionTempoBpm,
        ...(event.type === "target"
          ? {
              note: event.note,
              stringNumber: event.stringNumber
            }
          : {})
      });
      nextEventIndex += 1;
    }

    currentStartMs += repetitionDurationMs;
  }

  const chartLengthBeats = Number((sectionLengthBeats * loopRepetitionCount).toFixed(2));
  const chartDurationMs = currentStartMs;

  return {
    tempoBpm,
    beatDurationMs: Number(beatDurationMs.toFixed(2)),
    leadInBeats,
    leadInMs: Number(leadInMs.toFixed(2)),
    chartLengthBeats,
    chartDurationMs,
    practicePlan: {
      scope: practiceScope,
      loopSectionId: selectedSection?.id ?? null,
      loopSectionLabel: selectedSection?.label ?? null,
      loopRepetitionCount,
      loopTempoStepBpm,
      repetitions: practiceRepetitions
    },
    sections: filteredSections.map((section) => ({
      ...section,
      startTimeMs: Math.round(leadInMs + section.startBeat * beatDurationMs),
      durationMs: Math.round(section.lengthBeats * beatDurationMs)
    })),
    events,
    targets: events
      .filter((event) => event.type === "target")
      .map((target) => ({
        ...target,
        expectedReleaseTimeMs: target.expectedTimeMs + target.durationMs
      }))
      .map((target, index, targetList) => {
      const nextTarget = targetList[index + 1] ?? null;
      const scheduledBeat = target.beatOffset + 1;
      const measureNumber = Math.floor(target.beatOffset / 4) + 1;
      const beatWithinMeasure = (target.beatOffset % 4) + 1;
      const beatNumber = Math.floor(beatWithinMeasure);
      const subdivision = Number((beatWithinMeasure - beatNumber).toFixed(2));
      const timingWindowMs = Math.round(
        Math.max(65, Math.min(110, beatDurationMs * 0.22))
      );
      const releaseToleranceMs = Math.round(
        Math.max(45, Math.min(95, beatDurationMs * 0.18))
      );
      const nextTargetExpectedTimeMs = nextTarget?.expectedTimeMs ?? null;
      const releaseObservationEndMs = nextTargetExpectedTimeMs === null
        ? target.expectedReleaseTimeMs + releaseToleranceMs * 2
        : Math.min(nextTargetExpectedTimeMs, target.expectedReleaseTimeMs + releaseToleranceMs * 2);

      return {
        index,
        note: target.note,
        stringNumber: target.stringNumber,
        beatOffset: target.beatOffset,
        durationBeats: target.durationBeats,
        durationMs: target.durationMs,
        expectedTimeMs: target.expectedTimeMs,
        expectedReleaseTimeMs: target.expectedReleaseTimeMs,
        nextTargetExpectedTimeMs,
        timingWindowMs,
        releaseToleranceMs,
        releaseObservationEndMs,
        scheduledBeat: Number(scheduledBeat.toFixed(2)),
        measureNumber,
        beatNumber,
        subdivision,
        repetitionIndex: target.repetitionIndex ?? 0,
        repetitionTempoBpm: target.repetitionTempoBpm ?? tempoBpm,
        sectionId: target.sectionId,
        sectionLabel: target.sectionLabel
      };
    })
  };
}

export function getExerciseTargets(exerciseId, options = {}) {
  return getExerciseSchedule(exerciseId, options).targets;
}

export function getExercisePattern(exerciseId) {
  return getExerciseTargets(exerciseId).map((target) => target.note);
}
