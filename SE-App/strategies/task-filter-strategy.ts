import { Task } from '@/models/task';

// ─── Strategy interface ──────────────────────────────────────────────────────
// Pattern: Strategy + Open/Closed Principle
// Parallel to ITaskSortStrategy: adding a new filter rule = new class + registry
// entry. The UI and service never need to change.
export interface ITaskFilterStrategy {
  readonly label: string;
  filter(tasks: Task[]): Task[];
}

// ─── Concrete Strategy 1: show all ──────────────────────────────────────────
export class FilterAllStrategy implements ITaskFilterStrategy {
  readonly label = 'All';

  filter(tasks: Task[]): Task[] {
    return tasks;
  }
}

// ─── Concrete Strategy 2: show only active ──────────────────────────────────
export class FilterActiveStrategy implements ITaskFilterStrategy {
  readonly label = 'Active';

  filter(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.status === 'active');
  }
}

// ─── Concrete Strategy 3: show only completed ───────────────────────────────
export class FilterCompletedStrategy implements ITaskFilterStrategy {
  readonly label = 'Completed';

  filter(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.status === 'completed');
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────
export const FILTER_STRATEGIES: ITaskFilterStrategy[] = [
  new FilterAllStrategy(),
  new FilterActiveStrategy(),
  new FilterCompletedStrategy(),
];
