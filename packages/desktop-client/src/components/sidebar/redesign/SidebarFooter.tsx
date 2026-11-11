import { useTranslation } from 'react-i18next';

import { SvgCog } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';

import { HomeLink } from '#components/HomeLink';

import { NavRow } from './NavRow';

export function SidebarFooter() {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${theme.sidebarBorder}`,
        padding: spacing.sm,
      }}
    >
      <View
        style={{
          padding: spacing.sm,
          fontSize: 13,
          fontWeight: 500,
          color: theme.sidebarItemText,
        }}
      >
        <HomeLink showLabel />
      </View>
      <NavRow title={t('Settings')} Icon={SvgCog} to="/settings" />
    </View>
  );
}
