import React, { useEffect } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { autoOpenBudget } from '#budgetfiles/autoOpenBudget';
import {
  countAutoOpenRetry,
  resetAutoOpenRetries,
} from '#budgetfiles/budgetfilesSlice';
import { useDispatch, useSelector } from '#redux';

// Wait before each automatic retry (ms); after the last one, Retry stays.
export const AUTO_RETRY_DELAYS_MS = [2000, 5000, 10000];

/**
 * Home fork: shown in place of the welcome screen and file list while a
 * budget opens automatically. The app's loading indicator covers the work,
 * so this renders nothing unless the file list could not be loaded.
 */
export function AutoOpenBudget() {
  const dispatch = useDispatch();
  const status = useSelector(state => state.budgetfiles.autoOpen);

  const modalOpen = useSelector(state => state.modals.modalStack.length > 0);
  const retries = useSelector(state => state.budgetfiles.autoOpenRetries);

  useEffect(() => {
    if (
      status !== 'failed' ||
      modalOpen ||
      retries >= AUTO_RETRY_DELAYS_MS.length
    ) {
      return;
    }
    const timer = setTimeout(() => {
      dispatch(countAutoOpenRetry());
      void dispatch(autoOpenBudget());
    }, AUTO_RETRY_DELAYS_MS[retries]);
    return () => clearTimeout(timer);
  }, [dispatch, modalOpen, retries, status]);

  if (status !== 'failed' && status !== 'needs-user') {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', gap: 15, textAlign: 'center' }}>
      <Text style={{ fontSize: 16 }}>
        {status === 'needs-user' ? (
          <Trans>The budget needs your attention to open.</Trans>
        ) : (
          <Trans>Could not reach the budget server.</Trans>
        )}
      </Text>
      <Button
        variant="primary"
        onPress={() => {
          // A manual Retry starts a fresh automatic-retry cycle.
          dispatch(resetAutoOpenRetries());
          void dispatch(autoOpenBudget());
        }}
      >
        <Trans>Retry</Trans>
      </Button>
    </View>
  );
}
