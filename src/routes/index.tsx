import { createBrowserRouter, Navigate } from 'react-router';
import App from '../app';
import { HomePage } from '../pages/home';
import { SettingsPage } from '../pages/settings';
import { ConfigGroupPage } from '../pages/groups/[group-id]';
import { AIToolConfigPage } from '../pages/tools/[tool-id]';
import { LibraryPage } from '../pages/library';
import { MarketplacePage } from '../pages/marketplace';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/library" replace />,
      },
      {
        path: 'tools',
        element: <HomePage />,
      },
      {
        path: 'library',
        element: <LibraryPage />,
      },
      {
        path: 'marketplace',
        element: <MarketplacePage />,
      },
      {
        path: 'tools/:toolId',
        element: <AIToolConfigPage />,
      },
      {
        path: 'groups/:groupId',
        element: <ConfigGroupPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
