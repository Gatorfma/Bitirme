/**
 * Hooks Index
 * Re-export all hooks for convenient imports
 */

export { useAuth } from './useAuth';
export {
  useJournalSessions,
  useJournalSession,
  useCreateSession,
  useAppendThought,
  journalKeys,
} from './useJournal';
export {
  useCategories,
  useCategoryStats,
  useMindMap,
  categoryKeys,
} from './useCategories';
export {
  useBehaviors,
  useRecommendedBehaviors,
  useBehaviorFeedback,
  behaviorKeys,
} from './useBehaviors';
export {
  useStatsOverview,
  useMoodHistory,
  useImprovementScore,
  statsKeys,
} from './useStats';

