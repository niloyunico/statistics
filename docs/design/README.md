# Design sources — Nurse App (Android) and Admin App

These two `.dc.html` files are the Claude Design documents the phone apps were built
from (project `da6479d8-24ab-494d-a0fd-9c0fe5e7e150`). Each is an HTML template with
`{{ path }}` bindings, `<sc-if>` / `<sc-for>` blocks and an `<x-import>` Android device
frame, followed by a logic script.

Only the **template** part is consumed by the build:

    npm run design:import      # -> renderer/unico/nurse-app-view.jsx, admin-app-view.jsx
    npm run build              # -> renderer/dist/nurse-app.bundle.js, admin-app.bundle.js

`scripts/dc-to-jsx.js` converts the template mechanically into a React view that renders
against a flat view-model; the app logic lives in `renderer/unico/nurse-app.jsx` and
`renderer/unico/admin-app.jsx`, and the design's data constants in the matching
`*-app-data.js` files. So a re-exported design can be dropped in here and re-converted
without touching behaviour.

Note: the design-project export API caps a file at 256 KiB, so the logic script at the
end of each document is truncated in these copies. The markup (which is what the
converter reads) is complete.
