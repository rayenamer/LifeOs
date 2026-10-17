import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, RouteObject, RouterProvider } from 'react-router-dom';
import { sqlite } from './db/sqlite';
import { consistency, settings } from './core/services';
import { ToastProvider } from './ui/components';
import { Shell } from './Shell';
import { Today } from './pages/Today';
import { Months } from './pages/Months';
import { MonthDetail } from './pages/MonthDetail';
import { GoalDetail } from './pages/GoalDetail';
import { GoalWizard } from './pages/GoalWizard';
import { Insights } from './pages/Insights';
import { Reflections, Reflection } from './pages/Reflections';
import { MonthReview } from './pages/MonthReview';
import { Settings } from './pages/Settings';
import { Welcome } from './pages/Welcome';

export const routes: RouteObject[] = [
  { path: '/welcome', element: <Welcome /> },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Today /> },
      { path: 'months', element: <Months /> },
      { path: 'months/:year/:month', element: <MonthDetail /> },
      { path: 'months/:year/:month/goal/:goalId', element: <GoalDetail /> },
      { path: 'goals/new', element: <GoalWizard /> },
      { path: 'insights', element: <Insights /> },
      { path: 'reflection', element: <Reflections /> },
      { path: 'reflection/:weekStart', element: <Reflection /> },
      { path: 'review/:year/:month', element: <MonthReview /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  useEffect(() => {
    sqlite
      .init()
      .then(() => {
        settings.apply();
        consistency.recompute(); // a new day may have started since the last visit
        setState('ready');
      })
      .catch((e: unknown) => setState(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (state === 'loading') {
    return (
      <div className="boot">
        <span className="brand-mark big" />
        <p>Loading…</p>
      </div>
    );
  }
  if (state instanceof Error) {
    return (
      <div className="boot">
        <p>Couldn't start the database: {state.message}</p>
      </div>
    );
  }
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
