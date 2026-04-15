import { Task, CreateTaskDTO } from '@/models/task';

// ─── Interface (the abstraction all callers depend on) ──────────────────────
// Pattern: Repository + Dependency Inversion Principle
// TaskService depends on this interface, never on the concrete class below.
// Swapping to AsyncStorageTaskRepository or a remote API requires zero changes
// to any code above this layer.
export interface ITaskRepository {
  getAll(): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  create(dto: CreateTaskDTO): Promise<Task>;
  update(id: string, partial: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task>;
  delete(id: string): Promise<void>;
}

// ─── Concrete implementation ────────────────────────────────────────────────
// Single Responsibility: this class only knows how to store and retrieve tasks.
// It has no knowledge of sorting, filtering, or business logic.
export class InMemoryTaskRepository implements ITaskRepository {
  private tasks: Map<string, Task> = new Map();
  private nextId = 1;

  async getAll(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async create(dto: CreateTaskDTO): Promise<Task> {
    const task: Task = {
      id: String(this.nextId++),
      title: dto.title,
      description: dto.description ?? '',
      priority: dto.priority,
      status: 'active',
      createdAt: new Date(),
      completedAt: null,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async update(
    id: string,
    partial: Partial<Omit<Task, 'id' | 'createdAt'>>
  ): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`Task with id "${id}" not found`);
    }
    const updated: Task = { ...existing, ...partial };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }
}

// ─── Default singleton ───────────────────────────────────────────────────────
// Used as the default injection target. Code that needs different behavior
// (e.g. tests, alternative screens) injects a different instance.
export const defaultTaskRepository: ITaskRepository = new InMemoryTaskRepository();
