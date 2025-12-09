/**
 * Formatting Utilities
 * Helper functions for text and number formatting
 */

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format a number as percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a decimal as sentiment label
 */
export function formatSentiment(value: number): string {
  if (value > 0.3) return 'Positive';
  if (value < -0.3) return 'Negative';
  return 'Neutral';
}

/**
 * Get color for sentiment value
 */
export function getSentimentColor(value: number): string {
  if (value > 0.3) return '#7FB095'; // Positive - green
  if (value < -0.3) return '#C4A484'; // Negative - terracotta
  return '#9DAEBB'; // Neutral - gray-blue
}

/**
 * Format mood value (1-10) to emoji
 */
export function getMoodEmoji(mood: number): string {
  if (mood >= 8) return '😊';
  if (mood >= 6) return '🙂';
  if (mood >= 4) return '😐';
  if (mood >= 2) return '😕';
  return '😔';
}

/**
 * Format mood value to label
 */
export function getMoodLabel(mood: number): string {
  if (mood >= 8) return 'Great';
  if (mood >= 6) return 'Good';
  if (mood >= 4) return 'Okay';
  if (mood >= 2) return 'Low';
  return 'Difficult';
}

/**
 * Get behavior category icon
 */
export function getBehaviorCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    mindfulness: '🧘',
    activity: '🎯',
    social: '👥',
    cognitive: '🧠',
    physical: '🏃',
  };
  return icons[category] || '📌';
}

/**
 * Format streak count
 */
export function formatStreak(days: number): string {
  if (days === 0) return 'Start your streak!';
  if (days === 1) return '1 day streak 🔥';
  return `${days} day streak 🔥`;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * Format count with label
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

