import { configure } from "@testing-library/react-native";
import "@testing-library/react-native/matchers";
import "react-native-gesture-handler/jestSetup";

// RNTL's `waitFor` defaults to a 1s budget. That is ample when a suite runs
// alone and not nearly enough when Jest saturates every core: the screen
// tests mount a real QueryClient and wait on resolved promises, so under
// contention they lose the race and fail on timing rather than on behaviour.
// `app/(client)/__tests__/firma-bilgileri.test.tsx` was failing roughly two
// runs in three this way.
//
// Raising the budget hides nothing — an assertion that is genuinely wrong
// still fails, just later. Jest's own `testTimeout` is lifted to 15s in
// jest.config.js so it stays above this and reports the real cause.
configure({ asyncUtilTimeout: 5000 });
