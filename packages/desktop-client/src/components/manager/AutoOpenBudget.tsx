import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { autoOpenBudget } from '#budgetfiles/autoOpenBudget';
import { useDispatch, useSelector } from '#redux';

/**
 * Home fork: shown in place of the welcome screen and file list while a
 * budget opens automatically. The app's loading indicator covers the work,
 * so this renders nothing unless the file list could not be loaded.
 */
export function AutoOpenBudget() {
  const dispatch = useDispatch();
  const status = useSelector(state => state.budgetfiles.autoOpen);

  if (status !== 'failed') {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', gap: 15, textAlign: 'center' }}>
      <Text style={{ fontSize: 16 }}>
        <Trans>Could not reach the budget server.</Trans>
      </Text>
      <Button variant="primary" onPress={() => void dispatch(autoOpenBudget())}>
        <Trans>Retry</Trans>
      </Button>
    </View>
  );
}
