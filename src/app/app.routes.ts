import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/entrance/entrance.component').then((m) => m.EntranceComponent),
  },
  {
    path: 'app',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'months' },
      {
        path: 'months',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'today',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        path: 'insights',
        loadComponent: () =>
          import('./features/insights/insights.component').then((m) => m.InsightsComponent),
      },
      {
        path: 'reflection',
        loadComponent: () =>
          import('./features/weekly-review/weekly-review-list.component').then(
            (m) => m.WeeklyReviewListComponent,
          ),
      },
      {
        path: 'reflection/:weekStart',
        loadComponent: () =>
          import('./features/weekly-review/weekly-review.component').then(
            (m) => m.WeeklyReviewComponent,
          ),
      },
      {
        path: 'goals/new',
        loadComponent: () =>
          import('./features/goal-wizard/goal-wizard.component').then((m) => m.GoalWizardComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'months/:year/:month',
        loadComponent: () =>
          import('./features/month-detail/month-detail.component').then(
            (m) => m.MonthDetailComponent,
          ),
      },
      {
        path: 'months/:year/:month/goal/:goalId',
        loadComponent: () =>
          import('./features/goal-detail/goal-detail.component').then((m) => m.GoalDetailComponent),
      },
      {
        path: 'review/:year/:month',
        loadComponent: () =>
          import('./features/monthly-review/monthly-review.component').then(
            (m) => m.MonthlyReviewComponent,
          ),
      },
      { path: '**', redirectTo: 'months' },
    ],
  },
  { path: '**', redirectTo: '' },
];
