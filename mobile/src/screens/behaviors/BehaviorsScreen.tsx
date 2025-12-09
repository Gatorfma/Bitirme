/**
 * BehaviorsScreen
 * Behavioral interventions and tracking
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner, PrimaryButton } from '../../components/common';
import { useBehaviors, useBehaviorFeedback } from '../../hooks/useBehaviors';
import { getBehaviorCategoryIcon, formatRelativeTime } from '../../utils';
import type { Behavior } from '../../types/models';

function BehaviorCard({
  behavior,
  onTry,
}: {
  behavior: Behavior;
  onTry: () => void;
}) {
  return (
    <View style={styles.behaviorCard}>
      <View style={styles.behaviorHeader}>
        <View style={styles.behaviorIcon}>
          <Text style={styles.behaviorEmoji}>
            {getBehaviorCategoryIcon(behavior.category)}
          </Text>
        </View>
        <View style={styles.behaviorInfo}>
          <Text style={styles.behaviorName}>{behavior.name}</Text>
          <Text style={styles.behaviorCategory}>{behavior.category}</Text>
        </View>
        <View style={styles.successBadge}>
          <Text style={styles.successRate}>{behavior.successRate}%</Text>
        </View>
      </View>
      <Text style={styles.behaviorDescription}>{behavior.description}</Text>
      <View style={styles.behaviorFooter}>
        <Text style={styles.behaviorMeta}>
          Used {behavior.timesUsed} times
          {behavior.lastUsed && ` • Last: ${formatRelativeTime(behavior.lastUsed)}`}
        </Text>
        <TouchableOpacity style={styles.tryButton} onPress={onTry}>
          <Text style={styles.tryButtonText}>Try Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeedbackModal({
  visible,
  behavior,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  behavior: Behavior | null;
  onClose: () => void;
  onSubmit: (helpful: boolean, moodBefore: number, moodAfter: number) => void;
}) {
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);

  if (!behavior) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>How did it go?</Text>
          <Text style={styles.modalSubtitle}>{behavior.name}</Text>

          <View style={styles.moodSection}>
            <Text style={styles.moodLabel}>Mood Before (1-10)</Text>
            <View style={styles.moodButtons}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.moodButton,
                    moodBefore === val && styles.moodButtonActive,
                  ]}
                  onPress={() => setMoodBefore(val)}
                >
                  <Text
                    style={[
                      styles.moodButtonText,
                      moodBefore === val && styles.moodButtonTextActive,
                    ]}
                  >
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.moodSection}>
            <Text style={styles.moodLabel}>Mood After (1-10)</Text>
            <View style={styles.moodButtons}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.moodButton,
                    moodAfter === val && styles.moodButtonActive,
                  ]}
                  onPress={() => setMoodAfter(val)}
                >
                  <Text
                    style={[
                      styles.moodButtonText,
                      moodAfter === val && styles.moodButtonTextActive,
                    ]}
                  >
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <PrimaryButton
              title="Not Helpful"
              onPress={() => onSubmit(false, moodBefore, moodAfter)}
              variant="outline"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Helpful!"
              onPress={() => onSubmit(true, moodBefore, moodAfter)}
              style={{ flex: 1 }}
            />
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function BehaviorsScreen() {
  const { data: behaviors, isLoading } = useBehaviors();
  const feedbackMutation = useBehaviorFeedback();
  
  const [selectedBehavior, setSelectedBehavior] = useState<Behavior | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleTryBehavior = (behavior: Behavior) => {
    setSelectedBehavior(behavior);
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async (helpful: boolean, moodBefore: number, moodAfter: number) => {
    if (!selectedBehavior) return;

    await feedbackMutation.mutateAsync({
      behaviorId: selectedBehavior.id,
      feedback: { helpful, moodBefore, moodAfter },
    });

    setShowFeedback(false);
    setSelectedBehavior(null);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner message="Loading behaviors..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <View style={styles.header}>
        <AppHeader title="Actions" subtitle="Helpful interventions" />
      </View>

      <FlatList
        data={behaviors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BehaviorCard behavior={item} onTry={() => handleTryBehavior(item)} />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            These actions have helped others. Try one when you need support.
          </Text>
        }
      />

      <FeedbackModal
        visible={showFeedback}
        behavior={selectedBehavior}
        onClose={() => {
          setShowFeedback(false);
          setSelectedBehavior(null);
        }}
        onSubmit={handleSubmitFeedback}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
  },
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  listHeader: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 16,
    lineHeight: 20,
  },
  behaviorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECEB',
  },
  behaviorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  behaviorIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F4F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  behaviorEmoji: {
    fontSize: 22,
  },
  behaviorInfo: {
    flex: 1,
  },
  behaviorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  behaviorCategory: {
    fontSize: 12,
    color: '#636E72',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  successBadge: {
    backgroundColor: '#E8F0EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successRate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B8A72',
  },
  behaviorDescription: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
    marginBottom: 12,
  },
  behaviorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  behaviorMeta: {
    fontSize: 12,
    color: '#9DAEBB',
    flex: 1,
  },
  tryButton: {
    backgroundColor: '#5B8A72',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3436',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 24,
  },
  moodSection: {
    marginBottom: 20,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D3436',
    marginBottom: 12,
  },
  moodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodButtonActive: {
    backgroundColor: '#5B8A72',
  },
  moodButtonText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  moodButtonTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  cancelText: {
    color: '#636E72',
    fontSize: 15,
  },
});

