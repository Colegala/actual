import { send } from '@actual-app/core/platform/client/connection';
import type { File } from '@actual-app/core/types/file';
import { t } from 'i18next';

import { setAppState } from '#app/appSlice';
import { createAppAsyncThunk } from '#redux';
import type { AppDispatch } from '#redux/store';

import {
  createBudget,
  downloadBudget,
  loadBudget,
  setAllFiles,
  setAutoOpenStatus,
} from './budgetfilesSlice';

/** Name of the budget the home fork creates when the server has none. */
export const AUTO_OPEN_BUDGET_NAME = 'My Budget';

export type AutoOpenResult = 'opened' | 'created' | 'failed';

/**
 * Picks the budget to open. The server file list has no modified time, so
 * after the last-opened budget it prefers a budget already on this device,
 * then the first one in the (name-sorted) list.
 */
export function pickBudgetToOpen(
  files: readonly File[],
  lastBudgetId: string | null,
): File | null {
  const openable = files.filter(file => file.state !== 'broken');
  const onDevice = openable.filter(file => file.state !== 'remote');
  const last = lastBudgetId
    ? onDevice.find(file => file.id === lastBudgetId)
    : undefined;
  return last ?? onDevice[0] ?? openable[0] ?? null;
}

async function openFile(dispatch: AppDispatch, file: File) {
  if (file.state === 'remote') {
    await dispatch(downloadBudget({ cloudFileId: file.cloudFileId }));
  } else {
    await dispatch(loadBudget({ id: file.id }));
  }
}

export const autoOpenBudget = createAppAsyncThunk(
  'budgetfiles/autoOpenBudget',
  async (_, { dispatch, getState }): Promise<AutoOpenResult> => {
    // Returns the files, or null when the server list could not be read.
    async function fetchFiles(): Promise<File[] | null> {
      const budgets = await send('get-budgets');
      const remoteFiles = await send('get-remote-files');
      if (remoteFiles == null) {
        return null;
      }
      dispatch(setAllFiles({ budgets, remoteFiles }));
      return getState().budgetfiles.allFiles ?? [];
    }

    function fail(): AutoOpenResult {
      dispatch(setAppState({ loadingText: null }));
      dispatch(setAutoOpenStatus('failed'));
      return 'failed';
    }

    dispatch(setAutoOpenStatus('running'));
    dispatch(setAppState({ loadingText: t('Opening budget...') }));

    try {
      let files = await fetchFiles();
      if (files === null) {
        return fail();
      }

      const lastBudgetId = await send('get-last-opened-backup');
      let file = pickBudgetToOpen(files, lastBudgetId);

      if (!file) {
        // Check again right before creating, so a budget made in the
        // meantime (another tab or device) is opened, not duplicated.
        files = await fetchFiles();
        if (files === null) {
          return fail();
        }
        file = pickBudgetToOpen(files, lastBudgetId);
      }

      if (file) {
        await openFile(dispatch, file);
      } else {
        await dispatch(createBudget({ budgetName: AUTO_OPEN_BUDGET_NAME }));
      }

      dispatch(setAppState({ loadingText: null }));
      dispatch(setAutoOpenStatus('done'));
      return file ? 'opened' : 'created';
    } catch (error) {
      console.error('Error opening a budget automatically:', error);
      return fail();
    }
  },
  {
    // Run once per page load (and again only after a failure).
    condition: (_, { getState }) => {
      const status = getState().budgetfiles.autoOpen;
      return status === 'pending' || status === 'failed';
    },
  },
);
