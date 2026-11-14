import { send } from '@actual-app/core/platform/client/connection';
import type { File } from '@actual-app/core/types/file';
import { t } from 'i18next';

import { setAppState } from '#app/appSlice';
import { loadPrefs } from '#prefs/prefsSlice';
import { createAppAsyncThunk } from '#redux';
import type { AppDispatch, RootState } from '#redux/store';

import {
  downloadBudget,
  loadAllFiles,
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

function isBudgetOpen(state: RootState) {
  return Boolean(state.prefs.local?.id);
}

async function openFile(dispatch: AppDispatch, file: File) {
  if (file.state === 'remote') {
    await dispatch(
      downloadBudget({ cloudFileId: file.cloudFileId, silent: true }),
    );
  } else {
    await dispatch(loadBudget({ id: file.id, silent: true }));
  }
}

/**
 * Creates "My Budget" and makes sure the server has it. The backend ignores
 * upload errors on create, so a missing cloud file id means the upload
 * failed: try once more, and on failure close it and report false, so the
 * user sees Retry and a later device does not create a second copy.
 */
async function createUploadedBudget(dispatch: AppDispatch) {
  dispatch(setAppState({ loadingText: t('Creating budget...') }));
  const created = await send('create-budget', {
    budgetName: AUTO_OPEN_BUDGET_NAME,
    testMode: false,
  });
  if (created?.error) {
    return false;
  }

  const meta = await send('load-prefs');
  if (!meta?.cloudFileId) {
    const uploaded = await send('upload-budget');
    if (uploaded?.error) {
      await send('close-budget');
      return false;
    }
  }

  await dispatch(loadAllFiles());
  await dispatch(loadPrefs());
  return true;
}

export const autoOpenBudget = createAppAsyncThunk(
  'budgetfiles/autoOpenBudget',
  async (_, { dispatch, getState }): Promise<AutoOpenResult> => {
    // Reads the files. `serverOk` is false when the server list failed
    // (offline, server error, expired sign-in).
    async function readFiles() {
      const budgets = await send('get-budgets');
      const remoteFiles = await send('get-remote-files');
      dispatch(setAllFiles({ budgets, remoteFiles: remoteFiles ?? null }));
      return {
        files: getState().budgetfiles.allFiles ?? [],
        serverOk: remoteFiles != null,
      };
    }

    function finish(result: AutoOpenResult): AutoOpenResult {
      dispatch(setAppState({ loadingText: null }));
      dispatch(setAutoOpenStatus(result === 'failed' ? 'failed' : 'done'));
      return result;
    }

    async function open(file: File): Promise<AutoOpenResult> {
      // A budget opened meanwhile (App start-up, another action) wins.
      if (!isBudgetOpen(getState())) {
        await openFile(dispatch, file);
      }
      // downloadBudget and loadBudget report errors with an alert and
      // return normally (offline, 429, 5xx), so check the budget is open.
      // If not, show Retry; never leave the user on the file picker.
      return finish(isBudgetOpen(getState()) ? 'opened' : 'failed');
    }

    dispatch(setAutoOpenStatus('running'));
    dispatch(setAppState({ loadingText: t('Opening budget...') }));

    try {
      let { files, serverOk } = await readFiles();
      const lastBudgetId = await send('get-last-opened-backup');

      if (!serverOk) {
        // Offline use: open a budget that is already on this device.
        const onDevice = files.filter(file => file.state !== 'remote');
        const file = pickBudgetToOpen(onDevice, lastBudgetId);
        return file ? await open(file) : finish('failed');
      }

      let file = pickBudgetToOpen(files, lastBudgetId);
      if (!file) {
        // Check again right before creating, so a budget made in the
        // meantime (another tab or device) is opened, not duplicated.
        ({ files, serverOk } = await readFiles());
        if (!serverOk) {
          return finish('failed');
        }
        file = pickBudgetToOpen(files, lastBudgetId);
      }

      if (file) {
        // The server has no budget at all, only this device has one (an
        // earlier create whose upload failed): upload it before opening.
        const serverHasNone = files.every(f => f.state === 'local');
        if (file.state === 'local' && serverHasNone) {
          const uploaded = await send('upload-budget', { id: file.id });
          if (uploaded?.error) {
            return finish('failed');
          }
        }
        return await open(file);
      }

      if (isBudgetOpen(getState())) {
        return finish('opened');
      }
      const created = await createUploadedBudget(dispatch);
      return finish(created ? 'created' : 'failed');
    } catch (error) {
      console.error('Error opening a budget automatically:', error);
      return finish('failed');
    }
  },
  {
    // Run once per page load (again only after a failure), never while
    // another load is running or a budget is already open.
    condition: (_, { getState }) => {
      const state = getState();
      const status = state.budgetfiles.autoOpen;
      return (
        (status === 'pending' || status === 'failed') &&
        state.app.loadingText === null &&
        !isBudgetOpen(state)
      );
    },
  },
);
