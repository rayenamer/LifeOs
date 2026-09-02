import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => {
  console.error('LifeOS failed to start', err);
  const root = document.querySelector('app-root');
  if (root) {
    const message = err instanceof Error ? err.message : String(err);
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;gap:12px;font-family:monospace;color:#a8a8a8;
                  padding:24px;text-align:center">
        <div style="letter-spacing:.3em;font-size:12px;color:#ff5c6c">LIFEOS FAILED TO START</div>
        <div style="font-size:12px;max-width:60ch;line-height:1.7">${message}</div>
        <div style="font-size:11px;color:#6b6b6b">See the browser console for the full stack trace.</div>
      </div>`;
  }
});
