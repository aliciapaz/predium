I need your approval to write files. Could you grant write permission so I can make the changes? The edits I need to make are:

1. **Gemfile** - Replace `prawn`, `prawn-table`, `matrix` gems with `ferrum` (also remove `pdf-reader` from test group since it's Prawn-specific)
2. **public/service_worker.js** - New file for offline asset caching
3. **vendor/javascript/dexie.min.js** - Vendored Dexie.js library for IndexedDB
4. **app/javascript/controllers/offline_controller.js** - New Stimulus controller for online/offline status and sync
5. **config/importmap.rb** - Pin Dexie.js
6. **app/javascript/application.js** - Register the service worker

These are the only gaps between the current app and the spec. Everything else (Rails 8.1.2, PostgreSQL, Devise, ActionPolicy, Hotwire, Tailwind, AASM, Discard, Chart.js, I18n, Solid Queue/Cache/Cable, RSpec setup) is already properly configured.
