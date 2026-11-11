import React, { createContext, useContext, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { HomeLink } from '#components/HomeLink';

const HEADER_HEIGHT = 50;

type PageHeaderProps = {
  title: ReactNode;
  style?: CSSProperties;
};

export function PageHeader({ title, style }: PageHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginLeft: 20,
        ...style,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          fontSize: 25,
          fontWeight: 500,
        }}
      >
        {typeof title === 'string' ? <Text>{title}</Text> : title}
      </View>
    </View>
  );
}

type MobilePageHeaderProps = {
  title: ReactNode;
  style?: CSSProperties;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  /**
   * Home fork: show the Home link next to `leftContent`. Defaults to hidden
   * when `leftContent` is set (it is normally a back button); pass true when
   * `leftContent` is not a back button (e.g. the budget page menu button).
   */
  showHomeLink?: boolean;
};

const HOME_LINK_MIN_SIZE = 44;

// Home fork: tap target for the mobile Home icon (icon stays 20px, centered).
// Height is always 44px. Beside other left content (budget menu button) the
// wrapper is allowed to shrink (see MobilePageHeader) so the target never
// reaches into the title, and the width is 44px only when there is room.
function homeLinkHitArea(besideLeftContent: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    minWidth: besideLeftContent ? 0 : HOME_LINK_MIN_SIZE,
    width: besideLeftContent ? '100%' : undefined,
    minHeight: HOME_LINK_MIN_SIZE,
  };
}

export function MobilePageHeader({
  title,
  style,
  leftContent,
  rightContent,
  showHomeLink = !leftContent,
}: MobilePageHeaderProps) {
  // Home fork: with a menu button plus the Home link, the title (budget month
  // selector) can be wider than its 50% basis. Keep it at its content width and
  // let the side slots shrink, so the left slot ends where the title starts.
  const homeBesideContent = !!leftContent && showHomeLink;
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        // Extend under the status bar / notch (non-zero only in the native
        // mobile app, where the web view covers the whole screen).
        height: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top))`,
        paddingTop: 'env(safe-area-inset-top)',
        backgroundColor: theme.mobileHeaderBackground,
        '& *': {
          color: theme.mobileHeaderText,
        },
        '& button[data-pressed]': {
          backgroundColor: theme.mobileHeaderTextHover,
        },
        ...style,
      }}
    >
      <View
        style={{
          flexBasis: '25%',
          flexShrink: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          flexDirection: 'row',
        }}
      >
        {leftContent}
        {/* Home fork: skip the home icon when a back button uses the slot. */}
        {showHomeLink && (
          <View
            style={{
              justifyContent: 'center',
              // Beside other left content, reuse that content's 10px right
              // margin so the tap target can start at its edge.
              marginLeft: leftContent ? -10 : 0,
              ...(leftContent
                ? {
                    flex: `0 1 ${HOME_LINK_MIN_SIZE}px`,
                    minWidth: 0,
                  }
                : null),
            }}
          >
            <HomeLink style={homeLinkHitArea(!!leftContent)} />
          </View>
        )}
      </View>
      <h1
        style={{
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          flexBasis: '50%',
          ...(homeBesideContent
            ? { flexShrink: 0, minWidth: 'max-content' }
            : null),
          fontSize: 17,
          fontWeight: 500,
          overflowY: 'auto',
          display: 'flex',
          margin: 0,
          padding: 0,
        }}
      >
        {title}
      </h1>
      <View
        style={{
          flexBasis: '25%',
          flexShrink: 1,
          minWidth: 0,
          justifyContent: 'flex-end',
          flexDirection: 'row',
        }}
      >
        {rightContent}
      </View>
    </View>
  );
}

// On mobile the page header element stays mounted while navigating between
// pages so its background doesn't flash while the next page renders. Pages
// render their header into a single persistent `<MobilePageHeaderSlot />`
// (rendered by the app shell) through a portal. Without a provider (e.g. in
// tests or storybook) the header is rendered inline instead.
const MobilePageHeaderSlotContext = createContext<HTMLElement | null>(null);
const MobilePageHeaderSlotRefContext = createContext<
  ((element: HTMLElement | null) => void) | null
>(null);

export function MobilePageHeaderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <MobilePageHeaderSlotRefContext.Provider value={setSlot}>
      <MobilePageHeaderSlotContext.Provider value={slot}>
        {children}
      </MobilePageHeaderSlotContext.Provider>
    </MobilePageHeaderSlotRefContext.Provider>
  );
}

type MobilePageHeaderSlotProps = {
  style?: CSSProperties;
};

export function MobilePageHeaderSlot({ style }: MobilePageHeaderSlotProps) {
  const slotRef = useContext(MobilePageHeaderSlotRefContext);
  return (
    <View
      ref={slotRef ?? undefined}
      style={{
        flexShrink: 0,
        minHeight: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top))`,
        backgroundColor: theme.mobileHeaderBackground,
        ...style,
      }}
    />
  );
}

type PageProps = {
  header: ReactNode;
  style?: CSSProperties;
  padding?: number;
  children: ReactNode;
  footer?: ReactNode;
};

export function Page({ header, style, padding, children, footer }: PageProps) {
  const { isNarrowWidth } = useResponsive();
  const mobileHeaderSlot = useContext(MobilePageHeaderSlotContext);
  const childrenPadding = padding != null ? padding : isNarrowWidth ? 10 : 20;

  const headerToRender =
    typeof header === 'string' ? (
      isNarrowWidth ? (
        <MobilePageHeader title={header} />
      ) : (
        <PageHeader title={header} />
      )
    ) : (
      header
    );

  const main = (
    <View
      role="main"
      style={{
        flex: 1,
        overflowY: isNarrowWidth ? 'auto' : undefined,
        padding: `0 ${childrenPadding}px`,
      }}
    >
      {children}
    </View>
  );

  if (isNarrowWidth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.mobilePageBackground,
          ...style,
        }}
      >
        {mobileHeaderSlot
          ? createPortal(headerToRender, mobileHeaderSlot)
          : headerToRender}
        {main}
        {footer}
      </View>
    );
  }

  return (
    <View
      style={{
        ...styles.page,
        flex: 1,
        backgroundColor: theme.pageBackground,
        ...style,
      }}
    >
      {headerToRender}
      {main}
      {footer}
    </View>
  );
}
