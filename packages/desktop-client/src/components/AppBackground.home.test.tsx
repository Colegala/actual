import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setAppState } from '#app/appSlice';
import { createTestAppStore, TestProviders } from '#mocks';

import { AppBackground } from './AppBackground';

describe('AppBackground (home fork: loading text)', () => {
  it('centers the loading text so it lines up with the spinner when it wraps', () => {
    const store = createTestAppStore();
    store.dispatch(
      setAppState({
        loadingText: 'Initializing the connection to the local database...',
      }),
    );

    render(
      <TestProviders store={store}>
        <AppBackground />
      </TestProviders>,
    );

    const text = screen.getByText(
      'Initializing the connection to the local database...',
    );
    expect(getComputedStyle(text).textAlign).toBe('center');
  });
});
