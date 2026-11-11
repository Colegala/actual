import React, { useLayoutEffect } from 'react';

import { replaceModal } from '#modals/modalsSlice';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

type CreateAccountModalProps = Extract<
  ModalType,
  { name: 'add-account' }
>['options'];

// Home fork: bank sync is hidden, so "Add account" always means a local
// account. The upstream provider-selection UI (BuiltInProviders, "Set up bank
// sync") is no longer reachable from here.
export function CreateAccountModal(_props: CreateAccountModalProps) {
  const dispatch = useDispatch();

  useLayoutEffect(() => {
    dispatch(replaceModal({ modal: { name: 'add-local-account' } }));
  }, [dispatch]);

  return <div hidden />;
}
