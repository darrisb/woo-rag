# Chat Analytics Premium Tab

This extension is a sellable UI plugin for the Angular settings shell in `src/ui_v2`.

It is based on the older `feature3-chat-analytics` experience from:

- `src/ui/myobserver-woo-vektor/src/app/features/feature3-chat-analytics/feature3-chat-analytics.component.html`

## What it is

- A manifest-driven custom element tab for `My Observer > Settings`
- Designed to load through the existing `settings-ui-extensions` system
- Safe to ship separately from the core settings app
- Able to fall back to preview data if premium analytics REST routes are not installed

## Files

- `chat-analytics-premium-tab.js`
  Source of truth for the premium UI tab.
- `manifest.example.json`
  Example manifest entry for enabling the tab.

## Expected REST routes

The tab tries to call the current settings UI REST base URL with:

- `GET /analytics/sessions?page=<n>&perPage=<n>`
- `GET /analytics/session-transcript?sessionId=<id>`

If those routes are unavailable, the tab switches to preview data automatically.

## Shipping into the plugin package

The shippable copy lives in:

- `scripts/assets/settings-ui-extensions/chat-analytics-premium-tab.js`
- `scripts/assets/settings-ui-extensions/manifest.chat-analytics-premium.example.json`

That keeps the extension easy to sell as a drop-in pack without changing the core `manifest.json`, which remains empty by default for production installs.
