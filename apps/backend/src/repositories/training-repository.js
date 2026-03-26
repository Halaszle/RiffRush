import { seedTrainings } from "../data/trainings.js";

function cloneTraining(training) {
  return {
    ...training,
    noteSequence: [...(training.noteSequence ?? [])],
    targetSequence: (training.targetSequence ?? []).map((target) => ({ ...target })),
    contentGraph: training.contentGraph
      ? {
          isRoot: Boolean(training.contentGraph.isRoot),
          unlocks: [...(training.contentGraph.unlocks ?? [])]
        }
      : undefined,
    chartSummary: training.chartSummary ? { ...training.chartSummary } : undefined,
    chart: training.chart
      ? {
          sections: (training.chart.sections ?? []).map((section) => ({ ...section })),
          events: (training.chart.events ?? []).map((event) => ({ ...event }))
        }
      : undefined
  };
}

export class TrainingRepository {
  #trainings;

  constructor(trainings = seedTrainings) {
    this.#trainings = trainings.map((training) => cloneTraining(training));
  }

  list() {
    return this.#trainings.map((training) => cloneTraining(training));
  }

  findById(trainingId) {
    const training = this.#trainings.find((item) => item.id === trainingId);
    return training ? cloneTraining(training) : null;
  }
}
