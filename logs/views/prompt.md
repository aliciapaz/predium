Generate views for: Organization, User, Profile, Membership, Form, FormResponse.\n\nInclude index, show, new, edit, and form partials.\n\nUse Turbo Frames and Stimulus controllers where appropriate.\n\nFollow Telos frontend conventions (Hotwire):
- Default to server-side rendering — let Rails handle the HTML
- Use Turbo Frames for isolated page sections (modals, inline editing, lazy-loaded content)
- Use Turbo Streams for real-time updates (append, prepend, replace, update, remove)
- Stimulus controllers: small, focused, single responsibility
- Use data attributes for configuration, not hardcoded values
- No jQuery, React, Vue — stick to Stimulus for interactions
- Progressive enhancement: site works without JS, better with it