package health.unico.nurse;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

/**
 * UNICO Nurse — the Android shell around the Nurse App.
 *
 * The app itself is served by the hospital server (/app). This activity is a hardened
 * WebView: it only ever loads pages from the configured server, keeps the session
 * cookie between launches, hands tel:/mailto:/WhatsApp links to the phone, and shows a
 * setup page when no server address has been saved yet or the server cannot be reached.
 * No credentials are stored here — sign-in happens inside the web app against the server.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "unico";
    private static final String KEY_SERVER = "server";
    private WebView web;
    private ProgressBar bar;
    private String server;   // e.g. https://nurse.hospital.example  (no trailing slash)

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0d2a4a"));
        web = new WebView(this);
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(bar, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 6));
        setContentView(root);

        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setDatabaseEnabled(true);
        st.setCacheMode(WebSettings.LOAD_DEFAULT);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setAllowFileAccess(false);
        st.setAllowContentAccess(false);
        st.setSupportZoom(false);
        st.setBuiltInZoomControls(false);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        st.setUserAgentString(st.getUserAgentString() + " UNICONurseApp/" + BuildInfo.VERSION);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setBackgroundColor(Color.parseColor("#0d2a4a"));
        web.addJavascriptInterface(new Bridge(), "UNICOApp");

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int p) {
                bar.setProgress(p);
                bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handle(req.getUrl());
            }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handle(Uri.parse(url));
            }
            @Override public void onPageStarted(WebView v, String url, Bitmap favicon) { bar.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView v, String url) { bar.setVisibility(View.GONE); CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                // Only the main document matters; a missing image must not blank the app.
                if (req.isForMainFrame()) showSetup("Could not reach " + server + "\n" + err.getDescription());
            }
        });

        server = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SERVER, BuildInfo.DEFAULT_SERVER);
        if (server == null || server.trim().isEmpty()) showSetup(null); else loadApp();
    }

    /** Decide what to do with a navigation: same server stays in the app, everything else goes to the phone. */
    private boolean handle(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https")) {
            if (server != null && sameHost(uri, Uri.parse(server))) return false;   // our server: let the WebView load it
            open(uri); return true;                                                 // any other site: the browser
        }
        if (scheme.equals("file")) return true;                                     // never allow file:// from web content
        open(uri); return true;                                                     // tel:, mailto:, whatsapp:, sms: ...
    }
    private static boolean sameHost(Uri a, Uri b) {
        return a.getHost() != null && b.getHost() != null && a.getHost().equalsIgnoreCase(b.getHost()) && a.getPort() == b.getPort();
    }
    private void open(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { /* no app for this link */ }
    }
    private void loadApp() {
        web.loadUrl(server + "/app");
    }
    private void showSetup(String error) {
        String msg = error == null ? "" : error.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " · ");
        web.loadUrl("file:///android_asset/setup.html#server=" + Uri.encode(server == null ? "" : server) + "&error=" + Uri.encode(msg));
    }

    /** window.UNICOApp — the only bridge exposed to the page. It cannot read the phone; it can only set the server address. */
    private class Bridge {
        @JavascriptInterface public void setServer(final String url) {
            String u = url == null ? "" : url.trim();
            while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
            if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
            final String clean = u;
            runOnUiThread(() -> {
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, clean).apply();
                server = clean;
                loadApp();
            });
        }
        @JavascriptInterface public String getServer() { return server == null ? "" : server; }
        @JavascriptInterface public String getVersion() { return BuildInfo.VERSION; }
    }

    @Override public void onBackPressed() {
        if (web.canGoBack() && !web.getUrl().startsWith("file:")) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
