import React, { useEffect } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import {
  autoOpenBudget,
  hasUserActionModal,
} from '#budgetfiles/autoOpenBudget';
import {
  countAutoOpenRetry,
  resetAutoOpenRetries,
  setAutoOpenStatus,
} from '#budgetfiles/budgetfilesSlice';
import { pushModal } from '#modals/modalsSlice';
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

  const modalOpen = useSelector(hasUserActionModal);
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

  const error = useSelector(state => state.budgetfiles.autoOpenError);
  const retriesUsedUp = retries >= AUTO_RETRY_DELAYS_MS.length;

  if (status !== 'failed' && status !== 'needs-user' && status !== 'error') {
    return null;
  }

  const newerApp = status === 'needs-user' && error?.kind === 'newer-app';
  // The escape hatch to the stock file list, for this page load only.
  const showFiles = (
    <Button
      onPress={() => {
        dispatch(setAutoOpenStatus('done'));
      }}
    >
      <Trans>Show budget files</Trans>
    </Button>
  );
  const retryButton = (
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
  );

  return (
    <View style={{ alignItems: 'center', gap: 15, textAlign: 'center' }}>
      <Text style={{ fontSize: 16 }}>
        {newerApp ? (
          <Trans>This budget needs a newer version of the app.</Trans>
        ) : status === 'needs-user' ? (
          <Trans>The budget needs your attention to open.</Trans>
        ) : status === 'error' ? (
          <Trans>The budget could not be opened.</Trans>
        ) : (
          <Trans>Could not reach the budget server.</Trans>
        )}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {newerApp ? (
          <>
            <Button variant="primary" onPress={() => window.location.reload()}>
              <Trans>Reload app</Trans>
            </Button>
            <Button
              onPress={() =>
                dispatch(
                  pushModal({
                    modal: {
                      name: 'load-backup',
                      options: { budgetId: error?.budgetId },
                    },
                  }),
                )
              }
            >
              <Trans>Load a backup</Trans>
            </Button>
          </>
        ) : (
          retryButton
        )}
        {(status !== 'failed' || retriesUsedUp) && showFiles}
      </View>
    </View>
  );
}
