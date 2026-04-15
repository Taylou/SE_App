import { taskEventEmitter } from '@/events/task-event-emitter';
import { CreateTaskDTO, Task } from '@/models/task';
import { ITaskRepository, defaultTaskRepository } from '@/repositories/task-repository';
import {
  FilterAllStrategy,
  ITaskFilterStrategy,
} from '@/strategies/task-filter-strategy';
import {
  ITaskSortStrategy,
  SortByDateStrategy,
} from '@/strategies/task-sort-strategy';

// Pattern: Dependency Inversion Principle
// TaskService depends only on interfaces (ITaskRepository, ITaskSortStrategy,
// ITaskFilterStrategy). All concrete classes are injected via the constructor —
// this class never calls `new InMemoryTaskRepository()` or similar.
//
// Pattern: Single Responsibility
// Business logic lives here (e.g. setting completedAt). The repository only
// stores. Strategies only sort/filter. The event emitter only dispatches events.
export class TaskService {
  constructor(
    private readonly repository: ITaskRepository,
    private sortStrategy: ITaskSortStrategy,
    private filterStrategy: ITaskFilterStrategy
  ) {}

  // ─── Strategy setters ───────────────────────────────────────────────────
  // Swapping a strategy triggers an immediate re-emit of the processed list
  // so all observers update automatically without an explicit re-fetch.

  setSortStrategy(strategy: ITaskSortStrategy): void {
    this.sortStrategy = strategy;
    this.emitListChanged();
  }

  setFilterStrategy(strategy: ITaskFilterStrategy): void {
    this.filterStrategy = strategy;
    this.emitListChanged();
  }

  get currentSortStrategy(): ITaskSortStrategy {
    return this.sortStrategy;
  }

  get currentFilterStrategy(): ITaskFilterStrategy {
    return this.filterStrategy;
  }

  // get IncompleteTasks(): Task[] {
  //   return this.repository.getAll().filter(
  //     (task) => task.status === 'completed'
  //   );
  // }
  // ─── CRUD operations ────────────────────────────────────────────────────

  async createTask(dto: CreateTaskDTO): Promise<Task> {
    const task = await this.repository.create(dto);
    taskEventEmitter.emit('task:created', task);
    await this.emitListChanged();
    return task;
  }

  async completeTask(id: string): Promise<Task> {
    const updated = await this.repository.update(id, {
      status: 'completed',
      completedAt: new Date(),
    });
    taskEventEmitter.emit('task:updated', updated);
    await this.emitListChanged();
    return updated;
  }

  async uncompleteTask(id: string): Promise<Task> {
    const updated = await this.repository.update(id, {
      status: 'active',
      completedAt: null,
    });
    taskEventEmitter.emit('task:updated', updated);
    await this.emitListChanged();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await this.repository.delete(id);
    taskEventEmitter.emit('task:deleted', { id });
    await this.emitListChanged();
  }

  // ─── Derived list ────────────────────────────────────────────────────────
  // Filter is applied first to reduce the working set, then sort.
  async getProcessedTasks(): Promise<Task[]> {
    const all = await this.repository.getAll();
    const filtered = this.filterStrategy.filter(all);
    return this.sortStrategy.sort(filtered);
  }

  // ─── Internal helper ─────────────────────────────────────────────────────
  private async emitListChanged(): Promise<void> {
    const processed = await this.getProcessedTasks();
    taskEventEmitter.emit('task:list-changed', processed);
  }
}

// ─── Default singleton ───────────────────────────────────────────────────────
// Wired with in-memory defaults. Tests or alternative screens can instantiate
// their own TaskService with different strategies or repositories.
export const taskService = new TaskService(
  defaultTaskRepository,
  new SortByDateStrategy(),
  new FilterAllStrategy()
);
