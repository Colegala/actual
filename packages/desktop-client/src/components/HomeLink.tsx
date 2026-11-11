import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { SvgHome } from '@actual-app/components/icons/v1';

import { Link } from '#components/common/Link';
import { HOME_URL } from '#home-fork';

type HomeLinkProps = {
  /** Show the "Home" text next to the icon (desktop sidebar). */
  showLabel?: boolean;
};

// Home fork: link back to the main home app, in the same tab.
export function HomeLink({ showLabel = false }: HomeLinkProps) {
  const { t } = useTranslation();

  return (
    <Link
      variant="external"
      to={HOME_URL}
      sameTab
      linkColor="muted"
      aria-label={t('Home')}
    >
      <SvgHome width={showLabel ? 12 : 20} height={showLabel ? 12 : 20} />
      {showLabel && (
        <span style={{ marginLeft: 8 }}>
          <Trans>Home</Trans>
        </span>
      )}
    </Link>
  );
}
