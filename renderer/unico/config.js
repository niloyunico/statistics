/* UNICO build configuration.
   Set UNICO_DEFAULT_API to the HTTPS address of YOUR deployed UNICO auth/data
   server BEFORE building the .exe. Then everyone who installs the .exe just
   signs in — no settings to configure.

   IMPORTANT: this is only the server ADDRESS (a URL), never a password. The
   database connection string lives ONLY on that server, never in this app. */
window.UNICO_DEFAULT_API = ''; // empty = NO login, app runs fully offline. Put a server URL here later to re-enable cloud login.
