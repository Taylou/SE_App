import React, { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TaskItem } from '@/components/task-item';
import { useTasks } from '@/hooks/use-tasks';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TaskPriority, CreateTaskDTO } from '@/models/task';
import type { ITaskSortStrategy } from '@/strategies/task-sort-strategy';
import type { ITaskFilterStrategy } from '@/strategies/task-filter-strategy';

export default function TasksScreen() {
  const theme = useColorScheme() ?? 'light';
  const {
    tasks,
    isLoading,
    createTask,
    toggleTaskComplete,
    deleteTask,
    currentSortStrategy,
    currentFilterStrategy,
    sortStrategies,
    filterStrategies,
    setSortStrategy,
    setFilterStrategy,
  } = useTasks();

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');

  const handleAddTask = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      Alert.alert('Validation', 'Task title cannot be empty.');
      return;
    }
    const dto: CreateTaskDTO = {
      title,
      description: newDescription.trim() || undefined,
      priority: newPriority,
    };
    await createTask(dto);
    setNewTitle('');
    setNewDescription('');
    setNewPriority('medium');
    setModalVisible(false);
  }, [newTitle, newDescription, newPriority, createTask]);

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      {filterStrategies.map((strategy: ITaskFilterStrategy) => {
        const isActive = strategy === currentFilterStrategy;
        return (
          <TouchableOpacity
            key={strategy.label}
            style={[
              styles.chip,
              { borderColor: Colors[theme].tint },
              isActive && { backgroundColor: Colors[theme].tint },
            ]}
            onPress={() => setFilterStrategy(strategy)}>
            <ThemedText style={[styles.chipText, isActive && styles.activeChipText]}>
              {strategy.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSortRow = () => (
    <View style={styles.sortRow}>
      <ThemedText style={styles.sortLabel}>Sort:</ThemedText>
      {sortStrategies.map((strategy: ITaskSortStrategy) => {
        const isActive = strategy === currentSortStrategy;
        return (
          <TouchableOpacity
            key={strategy.label}
            style={[
              styles.sortChip,
              isActive && { backgroundColor: Colors[theme].tint },
            ]}
            onPress={() => setSortStrategy(strategy)}>
            <ThemedText style={[styles.sortChipText, isActive && styles.activeChipText]}>
              {strategy.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[theme].background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Tasks</ThemedText>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: Colors[theme].tint }]}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add new task">
          <ThemedText style={styles.addButtonText}>+ Add Task</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {renderFilterBar()}
      {renderSortRow()}

      {isLoading ? (
        <ThemedText style={styles.emptyText}>Loading…</ThemedText>
      ) : tasks.length === 0 ? (
        <ThemedText style={styles.emptyText}>
          No tasks yet. Tap "+ Add Task" to create one.
        </ThemedText>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskItem
              task={item}
              onToggleComplete={toggleTaskComplete}
              onDelete={deleteTask}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              New Task
            </ThemedText>

            <TextInput
              placeholder="Task title *"
              value={newTitle}
              onChangeText={setNewTitle}
              style={[
                styles.input,
                { borderColor: Colors[theme].icon, color: Colors[theme].text },
              ]}
              placeholderTextColor={Colors[theme].icon}
              autoFocus
            />

            <TextInput
              placeholder="Description (optional)"
              value={newDescription}
              onChangeText={setNewDescription}
              style={[
                styles.input,
                { borderColor: Colors[theme].icon, color: Colors[theme].text },
              ]}
              placeholderTextColor={Colors[theme].icon}
              multiline
            />

            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    { borderColor: Colors[theme].icon },
                    newPriority === p && { backgroundColor: Colors[theme].tint },
                  ]}
                  onPress={() => setNewPriority(p)}>
                  <ThemedText
                    style={[
                      styles.priorityChipText,
                      newPriority === p && styles.activeChipText,
                    ]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.cancelButton}>
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddTask}
                style={[
                  styles.saveButton,
                  { backgroundColor: Colors[theme].tint },
                ]}>
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  activeChipText: { color: '#fff' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  sortLabel: { fontSize: 13, opacity: 0.7 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sortChipText: { fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 48, opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityChipText: { fontSize: 13 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: { padding: 10 },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
});
