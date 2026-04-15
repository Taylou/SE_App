import { useState, useEffect, useCallback } from 'react';
import { Task, CreateTaskDTO } from '@/models/task';
import { taskService } from '@/services/task-service';
import { taskEventEmitter } from '@/events/task-event-emitter';
import { ITaskSortStrategy, SORT_STRATEGIES } from '@/strategies/task-sort-strategy';
import { ITaskFilterStrategy, FILTER_STRATEGIES } from '@/strategies/task-filter-strategy';

export interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  createTask: (dto: CreateTaskDTO) => Promise<void>;
  toggleTaskComplete: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  currentSortStrategy: ITaskSortStrategy;
  currentFilterStrategy: ITaskFilterStrategy;
  sortStrategies: ITaskSortStrategy[];
  filterStrategies: ITaskFilterStrategy[];
  setSortStrategy: (strategy: ITaskSortStrategy) => void;
  setFilterStrategy: (strategy: ITaskFilterStrategy) => void;
}

// Bridge between the service/event layer and React components.
// This is the only file that couples React to the service layer.
export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSortStrategy, setCurrentSortStrategy] = useState<ITaskSortStrategy>(
    taskService.currentSortStrategy
  );
  const [currentFilterStrategy, setCurrentFilterStrategy] = useState<ITaskFilterStrategy>(
    taskService.currentFilterStrategy
  );

  // Initial load
  useEffect(() => {
    taskService.getProcessedTasks().then((t) => {
      setTasks(t);
      setIsLoading(false);
    });
  }, []);

  // Subscribe to task:list-changed — Observer pattern hookup.
  // on() returns the unsubscribe function, which becomes the useEffect cleanup.
  useEffect(() => {
    return taskEventEmitter.on('task:list-changed', (updatedTasks) => {
      setTasks(updatedTasks);
    });
  }, []);

  const createTask = useCallback(async (dto: CreateTaskDTO) => {
    await taskService.createTask(dto);
    // No manual setTasks needed — the event bus delivers the updated list.
  }, []);

  const toggleTaskComplete = useCallback(async (task: Task) => {
    if (task.status === 'active') {
      await taskService.completeTask(task.id);
    } else {
      await taskService.uncompleteTask(task.id);
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await taskService.deleteTask(id);
  }, []);

  const setSortStrategy = useCallback((strategy: ITaskSortStrategy) => {
    taskService.setSortStrategy(strategy);
    setCurrentSortStrategy(strategy);
  }, []);

  const setFilterStrategy = useCallback((strategy: ITaskFilterStrategy) => {
    taskService.setFilterStrategy(strategy);
    setCurrentFilterStrategy(strategy);
  }, []);

  return {
    tasks,
    isLoading,
    createTask,
    toggleTaskComplete,
    deleteTask,
    currentSortStrategy,
    currentFilterStrategy,
    sortStrategies: SORT_STRATEGIES,
    filterStrategies: FILTER_STRATEGIES,
    setSortStrategy,
    setFilterStrategy,
  };
}
