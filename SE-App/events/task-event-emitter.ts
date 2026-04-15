import { Task } from '@/models/task';

// ─── Typed event map ─────────────────────────────────────────────────────────
// Pattern: Observer
// This is the single source of truth for all task events and their payloads.
// TypeScript enforces that emitters and listeners agree on payload types.
export interface TaskEvents {
  'task:created': Task;
  'task:updated': Task;
  'task:deleted': { id: string };
  'task:list-changed': Task[];
}

// ─── Typed wrapper ────────────────────────────────────────────────────────────
// Wraps (does not extend) EventEmitter to keep the public API minimal and typed.
// Callers cannot accidentally call raw methods like removeAllListeners().
class TypedTaskEventEmitter {
  private listeners: { [K in keyof TaskEvents]?: Array<(payload: TaskEvents[K]) => void> } = {};

  emit<K extends keyof TaskEvents>(event: K, payload: TaskEvents[K]): void {
    const handlers = this.listeners[event] as Array<(payload: TaskEvents[K]) => void> | undefined;
    handlers?.forEach(h => h(payload));
  }

  // Returns an unsubscribe function so React useEffect cleanup is ergonomic:
  //   useEffect(() => taskEventEmitter.on('task:list-changed', cb), []);
  on<K extends keyof TaskEvents>(
    event: K,
    listener: (payload: TaskEvents[K]) => void
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as Array<(payload: TaskEvents[K]) => void>).push(listener);
    return () => {
      this.listeners[event] = (this.listeners[event] as Array<(payload: TaskEvents[K]) => void>).filter(h => h !== listener) as any;
    };
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────
// One shared event bus for the entire app.
export const taskEventEmitter = new TypedTaskEventEmitter();
