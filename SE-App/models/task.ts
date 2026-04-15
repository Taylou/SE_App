export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'active' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  priority: TaskPriority;
}
