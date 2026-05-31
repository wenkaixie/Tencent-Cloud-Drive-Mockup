import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { WorkbenchPage } from './pages/WorkbenchPage';
import { GroupPage } from './pages/GroupPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { PersonalPage } from './pages/PersonalPage';
import { SharedWithMePage } from './pages/SharedWithMePage';
import { SharedLinksPage } from './pages/SharedLinksPage';
import { DeletionRestorePage } from './pages/DeletionRestorePage';
import { SuspiciousFilePage } from './pages/SuspiciousFilePage';
import { SplitViewPage } from './pages/SplitViewPage';
import { FileCollectionPage } from './pages/FileCollectionPage';
import { CollectionSubmitPage } from './pages/CollectionSubmitPage';
import { InvitePage } from './pages/InvitePage';

const roleChildren = [
  { index: true, Component: WorkbenchPage },
  { path: 'workbench', Component: WorkbenchPage },
  { path: 'group', Component: GroupPage },
  { path: 'group/:groupId', Component: GroupDetailPage },
  { path: 'group/:groupId/*', Component: GroupDetailPage },
  { path: 'personal', Component: PersonalPage },
  { path: 'shared-with-me', Component: SharedWithMePage },
  { path: 'shared-links', Component: SharedLinksPage },
  { path: 'deletion-restore', Component: DeletionRestorePage },
  { path: 'suspicious-file', Component: SuspiciousFilePage },
  { path: 'file-collection', Component: FileCollectionPage },
];

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/split" replace /> },
  { path: '/split', Component: SplitViewPage },
  { path: '/collect/:id', Component: CollectionSubmitPage },
  { path: '/invite/:code', Component: InvitePage },
  { path: '/:role', Component: Layout, children: roleChildren },
]);
