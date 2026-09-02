import {
  ApplicationConfig,
  EnvironmentInjector,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { SqliteService } from './core/database/sqlite.service';
import { ConsistencyService } from './core/services/consistency.service';
import { SettingsService } from './core/services/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideCharts(withDefaultRegisterables()),
    provideAppInitializer(() => {
      // Capture the injector synchronously — inject() is unavailable after `await`,
      // and the DB-touching services must not be resolved until init() has run.
      const injector = inject(EnvironmentInjector);
      return (async () => {
        await injector.get(SqliteService).init();
        injector.get(SettingsService).load();
        injector.get(ConsistencyService).refresh();
      })();
    }),
  ],
};
