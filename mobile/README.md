# MindJournal Mobile App

AI-powered thought journaling application built with React Native and Expo.

## Tech Stack

- **Expo** (React Native, TypeScript)
- **React Navigation v6** (Stack + Bottom Tabs)
- **Zustand** for global state management
- **React Query (TanStack Query)** for server communication
- **Expo SecureStore** for auth token storage
- **react-native-svg** for mind map & chart visuals

## Project Structure

```
mobile/
├── App.tsx                 # App entry point
├── app.json               # Expo configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── babel.config.js        # Babel configuration
└── src/
    ├── api/               # API layer with mock implementations
    │   ├── client.ts      # HTTP client with auth injection
    │   ├── auth.ts        # Authentication endpoints
    │   ├── journal.ts     # Journal session endpoints
    │   ├── categories.ts  # Categories & mind map endpoints
    │   ├── behaviors.ts   # Behavioral interventions endpoints
    │   └── stats.ts       # Statistics endpoints
    │
    ├── navigation/        # React Navigation setup
    │   ├── RootNavigator.tsx     # Main navigator (handles auth state)
    │   ├── AuthNavigator.tsx     # Auth flow (Login, Register)
    │   └── MainTabNavigator.tsx  # Bottom tabs (main app)
    │
    ├── screens/           # Screen components
    │   ├── auth/          # Login, Register
    │   ├── onboarding/    # Onboarding flow
    │   ├── journal/       # Journal home, new session, session detail
    │   ├── mindmap/       # Mind map visualization
    │   ├── stats/         # Statistics dashboard
    │   ├── behaviors/     # Behavioral interventions
    │   └── profile/       # User profile & settings
    │
    ├── components/        # Reusable UI components
    │   ├── common/        # PrimaryButton, TextInputField, LoadingSpinner
    │   ├── layout/        # ScreenContainer, AppHeader
    │   ├── journal/       # MessageBubble, QuestionBubble
    │   └── charts/        # TrendChart, EmotionChart
    │
    ├── state/             # Zustand stores
    │   ├── authStore.ts   # Auth state (token, user, onboarding)
    │   └── uiStore.ts     # UI state (theme, loading, toasts)
    │
    ├── hooks/             # React Query hooks
    │   ├── useAuth.ts     # Authentication logic
    │   ├── useJournal.ts  # Journal data hooks
    │   ├── useCategories.ts # Categories & mind map hooks
    │   ├── useBehaviors.ts  # Behaviors hooks
    │   └── useStats.ts    # Statistics hooks
    │
    ├── utils/             # Utility functions
    │   ├── dates.ts       # Date formatting helpers
    │   └── formatting.ts  # Text & number formatting
    │
    └── types/             # TypeScript definitions
        ├── models.ts      # Domain models
        ├── api.ts         # API request/response types
        └── navigation.ts  # Navigation param types
```

## Navigation Flow

```
RootNavigator
├── AuthNavigator (if not authenticated)
│   ├── LoginScreen
│   └── RegisterScreen
│
├── OnboardingScreen (if authenticated but not onboarded)
│
└── MainTabNavigator (if authenticated and onboarded)
    ├── JournalHome (default tab)
    │   ├── JournalHomeScreen
    │   ├── NewSessionScreen
    │   └── SessionDetailScreen
    ├── MindMapScreen
    ├── StatsScreen
    ├── BehaviorsScreen
    └── ProfileScreen
```

## Getting Started

### Prerequisites

- Node.js 18+
- Android Studio with Pixel 8 (Android 16) emulator
- Expo CLI

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Android Emulator

1. Start Android Studio and launch the Pixel 8 emulator
2. Run `npx expo start --android`

Or press `a` in the Expo CLI menu after starting.

## API Configuration

The app uses mock data by default. To connect to a real backend:

1. Set the `EXPO_PUBLIC_API_BASE_URL` environment variable
2. Replace mock implementations in `src/api/` with real API calls

Example `.env`:
```
EXPO_PUBLIC_API_BASE_URL=http://your-api-server.com/api
```

## Key Features

- **Chat-based Journaling**: Express thoughts through natural conversation
- **Mind Map Visualization**: See thought patterns organized by category
- **Statistics Dashboard**: Track mood trends and emotional patterns
- **Behavioral Interventions**: Evidence-based coping strategies with feedback
- **Secure Authentication**: JWT tokens stored in Expo SecureStore

## Development Notes

- All API calls return mock data - ready for backend integration
- Zustand stores persist auth state to SecureStore
- React Query handles caching and refetching
- TypeScript strict mode enabled for type safety
