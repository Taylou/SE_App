import { Task } from '@/models/task';

// ─── Strategy interface ──────────────────────────────────────────────────────
// Pattern: Strategy + Open/Closed Principle
// Each concrete class encapsulates one sorting algorithm. To add a new sort
// criterion, add a new class and register it — no existing code is modified.
export interface ITaskSortStrategy {
  readonly label: string;
  sort(tasks: Task[]): Task[];
}

// ─── Concrete Strategy 1: newest first ──────────────────────────────────────
export class SortByDateStrategy implements ITaskSortStrategy {
  readonly label = 'Date';

  sort(tasks: Task[]): Task[] {
    return [...tasks].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}

// ─── Concrete Strategy 2: high → medium → low ───────────────────────────────
const PRIORITY_ORDER: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class SortByPriorityStrategy implements ITaskSortStrategy {
  readonly label = 'Priority';

  sort(tasks: Task[]): Task[] {
    return [...tasks].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
  }
}

// ─── Concrete Strategy 3: A → Z ─────────────────────────────────────────────
export class SortByNameStrategy implements ITaskSortStrategy {
  readonly label = 'Name';

  sort(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────
// The UI iterates this to render sort chips — no switch/if-else on strategy type.
export const SORT_STRATEGIES: ITaskSortStrategy[] = [
  new SortByDateStrategy(),
  new SortByPriorityStrategy(),
  new SortByNameStrategy(),
];
