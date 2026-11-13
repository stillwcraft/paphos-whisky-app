import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { backButton, initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import type { MiniAppDestination } from '@/miniAppDeepLinks';

const DistilleriesTab = lazy(() => import('../DistilleriesTab').then(m => ({ default: m.DistilleriesTab })));
const EventsTab = lazy(() => import('../EventsTab').then(m => ({ default: m.EventsTab })));
const CyprusEventsMap = lazy(() => import('../CyprusEventsMap').then(m => ({ default: m.CyprusEventsMap })));
const ScotlandWhiskyMap = lazy(() => import('../ScotlandWhiskyMap').then(m => ({ default: m.ScotlandWhiskyMap })));
const NewsFeedTab = lazy(() => import('../news/NewsFeedTab').then(m => ({ default: m.NewsFeedTab })));
const BottlesSamplesTab = lazy(() => import('../BottlesSamplesTab').then(m => ({ default: m.BottlesSamplesTab })));
const ProfileTab = lazy(() => import('../ProfileTab').then(m => ({ default: m.ProfileTab })));
const AdminTab = lazy(() => import('../AdminTab').then(m => ({ default: m.AdminTab })));
const PresentationScreen = lazy(() => import('./PresentationScreen').then(m => ({ default: m.PresentationScreen })));
const PresentationBroadcastTab = lazy(() => import('./PresentationBroadcastTab').then(m => ({ default: m.PresentationBroadcastTab })));

export function PresentationLinkScreen({ destination, onClose, onNavigate, style }: {
  destination: MiniAppDestination;
  onClose: () => void;
  onNavigate: (destination: MiniAppDestination) => void;
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const user = useSignal(initData.state)?.user;
  const adminId = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID);
  const isAdmin = Number.isSafeInteger(adminId) && user?.id === adminId;
  const [selectedId, setSelectedId] = useState<number | null>(() => destination.kind === 'entity'
    ? destination.id : destination.kind === 'tab' ? destination.distilleryId ?? null : null);
  const [openReports, setOpenReports] = useState(destination.kind === 'tab' && Boolean(destination.openReports));
  const clearSelected = useCallback(() => setSelectedId(null), []);
  const clearReports = useCallback(() => setOpenReports(false), []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const entity = destination.kind === 'entity' ? destination.entity : null;
  const tab = destination.kind === 'tab' ? destination.tab : null;
  const fullScreen = destination.kind === 'presentation' || tab === 'presentations'
    || tab === 'map' || tab === 'cyprus-map' || entity === 'social_event';

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    if (!backButton.show.isAvailable() || !backButton.onClick.isAvailable()) return;
    const wasVisible = backButton.isVisible();
    const unsubscribe = backButton.onClick(() => {
      if (!dialogRef.current?.querySelector('.presentation-link-screen')) onClose();
    });
    backButton.show();
    return () => {
      unsubscribe();
      if (!wasVisible) backButton.hide.ifAvailable();
    };
  }, [onClose]);

  let content: ReactNode;
  if (destination.kind === 'presentation') {
    content = <PresentationScreen roomId={destination.roomId} onClose={onClose}
      onRoute={route => onNavigate({ kind: 'tab', tab: route })} />;
  } else if (entity === 'bottle' || entity === 'distillery' || tab === 'distilleries') {
    content = <DistilleriesTab
      selectedBottleId={entity === 'bottle' ? selectedId : null}
      selectedDistilleryId={entity === 'distillery' ? selectedId : null}
      onSelectedBottleHandled={clearSelected} onSelectedDistilleryHandled={clearSelected}
      onBottleClosed={entity === 'bottle' ? onClose : undefined}
      onDistilleryClosed={entity === 'distillery' ? onClose : undefined}
      onNavigateToMap={() => onNavigate({ kind: 'tab', tab: 'map' })}
      onOpenOnMap={id => onNavigate({ kind: 'tab', tab: 'map', distilleryId: id })} />;
  } else if (entity === 'event' || tab === 'events') {
    content = <EventsTab selectedEventId={entity === 'event' ? selectedId : null}
      onSelectedEventHandled={clearSelected} onDetailClosed={entity === 'event' ? onClose : undefined} />;
  } else if (entity === 'social_event' || tab === 'cyprus-map') {
    content = <CyprusEventsMap isAdmin={isAdmin}
      initialSocialEventId={entity === 'social_event' ? selectedId : null} onSocialEventHandled={clearSelected}
      onSelectEvent={id => onNavigate({ kind: 'entity', entity: 'event', id })}
      onDetailClosed={entity === 'social_event' ? onClose : undefined}
      openReports={openReports} onReportsHandled={clearReports} />;
  } else if (tab === 'map') {
    content = <ScotlandWhiskyMap selectedDistilleryId={selectedId} onSelectedDistilleryHandled={clearSelected}
      onSelectDistillery={distillery => onNavigate({ kind: 'entity', entity: 'distillery', id: distillery.id })} onClose={onClose} />;
  } else if (tab === 'bottles') {
    content = <BottlesSamplesTab />;
  } else if (tab === 'profile') {
    content = <ProfileTab />;
  } else if (tab === 'articles' && (import.meta.env.DEV || isAdmin)) {
    content = <NewsFeedTab />;
  } else if (tab === 'admin' && isAdmin) {
    content = <AdminTab onOpenSocialReports={() => onNavigate({ kind: 'tab', tab: 'cyprus-map', openReports: true })}
      onPresentationBroadcastStarted={() => onNavigate({ kind: 'tab', tab: 'presentations' })} />;
  } else if (tab === 'presentations') {
    content = <PresentationBroadcastTab isAdmin={isAdmin} onClose={onClose}
      onRoute={route => onNavigate({ kind: 'tab', tab: route })}
      onManage={() => onNavigate({ kind: 'tab', tab: 'admin' })} />;
  } else {
    content = <p role="alert">{t('presentation.link_unavailable')}</p>;
  }

  return <section ref={dialogRef} className="presentation-link-screen" style={style} role="dialog" aria-modal="true"
    aria-label={t('presentation.return_to_presentation')}>
    <header className="presentation-link-toolbar">
      <button ref={closeRef} type="button" onClick={onClose}>{t('presentation.return_to_presentation')}</button>
    </header>
    <main className={`presentation-link-content${fullScreen ? ' presentation-link-content--full-screen' : ''}`}>
      <Suspense fallback={<p role="status">{t('common.loading')}</p>}>{content}</Suspense>
    </main>
  </section>;
}
