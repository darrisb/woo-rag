import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { SETTINGS_UI_CONFIG } from './settings-config.token';
import { SettingsUiExtensionManifest, SettingsUiExtensionTab, SettingsUiShellTab } from './settings.models';

@Injectable({ providedIn: 'root' })
export class SettingsUiExtensionsService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(SETTINGS_UI_CONFIG);
  private readonly loadedScripts = new Map<string, Promise<void>>();

  loadWidgetTabs(): Observable<SettingsUiShellTab[]> {
    const manifestUrl = this.config.extensions.manifestUrl.trim();
    if (manifestUrl === '') {
      return of([]);
    }

    return this.http.get<SettingsUiExtensionManifest>(manifestUrl).pipe(
      map((manifest) => this.normalizeWidgetTabs(manifest)),
      catchError(() => of([]))
    );
  }

  ensureTabScript(tab: SettingsUiShellTab): Promise<void> {
    if (tab.type !== 'custom-element' || !tab.scriptUrl) {
      return Promise.resolve();
    }

    const src = tab.scriptUrl.trim();
    if (src === '') {
      return Promise.resolve();
    }

    const existing = this.loadedScripts.get(src);
    if (existing) {
      return existing;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.type = 'module';
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load extension script: ${src}`));
      this.document.head.appendChild(script);
    });

    this.loadedScripts.set(src, promise);
    return promise;
  }

  private normalizeWidgetTabs(manifest: SettingsUiExtensionManifest): SettingsUiShellTab[] {
    const tabs = Array.isArray(manifest?.tabs) ? manifest.tabs : [];

    return tabs
      .filter((tab): tab is SettingsUiExtensionTab => {
        return !!tab
          && tab.section === 'widget'
          && tab.type === 'custom-element'
          && typeof tab.id === 'string'
          && typeof tab.label === 'string'
          && typeof tab.elementTag === 'string'
          && typeof tab.scriptUrl === 'string';
      })
      .map((tab) => ({
        id: tab.id.trim(),
        label: tab.label.trim(),
        section: 'widget' as const,
        type: 'custom-element' as const,
        elementTag: tab.elementTag.trim(),
        scriptUrl: this.resolveScriptUrl(tab.scriptUrl),
        order: typeof tab.order === 'number' ? tab.order : 100,
      }))
      .filter((tab) => tab.id !== '' && tab.label !== '' && tab.elementTag !== '' && tab.scriptUrl !== '');
  }

  private resolveScriptUrl(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      return trimmed;
    }

    return this.config.extensions.assetsBaseUrl.replace(/\/$/, '') + '/' + trimmed.replace(/^\.\//, '');
  }
}
