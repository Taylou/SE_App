import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Task } from '@/models/task';

// Single Responsibility: this component only renders one task row and surfaces
// user gestures upward via callbacks. It has no knowledge of the service layer.

interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

export function TaskItem({ task, onToggleComplete, onDelete }: TaskItemProps) {
  const theme = useColorScheme() ?? 'light';
  const borderColor = useThemeColor({}, 'icon');
  const isCompleted = task.status === 'completed';

  const handleToggle = useCallback(
    () => onToggleComplete(task),
    [task, onToggleComplete]
  );
  const handleDelete = useCallback(
    () => onDelete(task.id),
    [task.id, onDelete]
  );

  return (
    <ThemedView style={[styles.container, { borderColor }]}>
      <View
        style={[
          styles.priorityStrip,
          { backgroundColor: PRIORITY_COLORS[task.priority] },
        ]}
      />

      <TouchableOpacity
        style={[
          styles.checkbox,
          { borderColor: Colors[theme].tint },
          isCompleted && { backgroundColor: Colors[theme].tint },
        ]}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={`Mark ${task.title} as ${isCompleted ? 'active' : 'complete'}`}
      />

      <View style={styles.content}>
        <ThemedText
          type="defaultSemiBold"
          style={isCompleted ? styles.completedText : undefined}>
          {task.title}
        </ThemedText>
        {task.description ? (
          <ThemedText style={[styles.description, isCompleted ? styles.completedText : undefined]}>
            {task.description}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.meta}>
          {task.priority.toUpperCase()} · {task.createdAt.toLocaleDateString()}
        </ThemedText>
      </View>

      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel={`Delete task ${task.title}`}>
        <ThemedText style={styles.deleteText}>✕</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  priorityStrip: {
    width: 4,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginHorizontal: 12,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  deleteButton: {
    padding: 12,
  },
  deleteText: {
    fontSize: 16,
  },
});
