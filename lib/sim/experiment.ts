import { DEFAULT_MODEL } from "./memory";
import { PRESETS } from "./presets";
import { simulate } from "./engine";
import { findReservationFailure, generateWorkload } from "./workload";
import type {
  ExperimentConfig,
  ReservationFailure,
  SimulationConfig,
  SimulationResult,
  Workload,
} from "./types";

export function simulationConfigFor(
  experiment: ExperimentConfig,
): SimulationConfig {
  return {
    memoryBudgetGiB: experiment.memoryBudgetGiB,
    model: DEFAULT_MODEL,
    maxConfiguredTurns: PRESETS[experiment.preset].turnRange[1],
  };
}

export type ExperimentRun =
  | {
      ok: true;
      config: ExperimentConfig;
      workload: Workload;
      lru: SimulationResult;
      aware: SimulationResult;
    }
  | {
      ok: false;
      config: ExperimentConfig;
      failure: ReservationFailure;
    };

export function runExperiment(config: ExperimentConfig): ExperimentRun {
  const sim = simulationConfigFor(config);
  const workload = generateWorkload(config);
  const failure = findReservationFailure(workload, sim);
  if (failure) {
    return { ok: false, config, failure };
  }
  const lru = simulate({ workload, policy: "lru", config: sim });
  const aware = simulate({
    workload,
    policy: "trajectory-aware",
    config: sim,
  });
  return { ok: true, config, workload, lru, aware };
}
