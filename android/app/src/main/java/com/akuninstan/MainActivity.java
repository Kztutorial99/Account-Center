package com.akuninstan;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://accounter.my.id/";
    private static final String APP_HOST = "accounter.my.id";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final Handler syncHandler = new Handler(Looper.getMainLooper());

    private final androidx.activity.result.ActivityResultLauncher<Intent> fileChooser =
            registerForActivityResult(
                    new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(),
                    result -> {
                        if (filePathCallback == null) return;
                        Uri[] uris = null;
                        if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                            Uri data = result.getData().getData();
                            if (data != null) uris = new Uri[]{data};
                        }
                        filePathCallback.onReceiveValue(uris);
                        filePathCallback = null;
                    });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost();
                String scheme = url.getScheme();
                boolean internal = host != null && (host.equals(APP_HOST) || host.endsWith("." + APP_HOST));
                if (internal) return false;
                if (scheme != null && (scheme.equals("http") || scheme.equals("https")
                        || scheme.equals("intent") || scheme.equals("mailto") || scheme.equals("tel")
                        || scheme.equals("whatsapp"))) {
                    openExternally(url);
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    fileChooser.launch(params.createIntent());
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                openExternally(Uri.parse(url));
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            Uri deepLink = getIntent() != null ? getIntent().getData() : null;
            webView.loadUrl(deepLink != null ? deepLink.toString() : START_URL);
        }
    }

    /** Sinkronisasi halus: minta halaman memuat ulang data tanpa refresh penuh bila memungkinkan. */
    private final Runnable softSync = new Runnable() {
        @Override
        public void run() {
            syncPage();
        }
    };

    private void syncPage() {
        if (webView == null) return;
        webView.evaluateJavascript(
                "(function(){"
                        + "if(document.visibilityState!=='visible')return 'hidden';"
                        + "if(typeof window.appSync==='function'){window.appSync();return 'appSync';}"
                        + "window.dispatchEvent(new Event('focus'));"
                        + "document.dispatchEvent(new Event('visibilitychange'));"
                        + "return 'events';"
                        + "})()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        // Jangan reload halaman: cukup minta data tersegarkan di belakang layar
        syncHandler.removeCallbacks(softSync);
        syncHandler.postDelayed(softSync, 150);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        syncHandler.removeCallbacks(softSync);
    }

    @Override
    protected void onDestroy() {
        syncHandler.removeCallbacks(softSync);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private void openExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, R.string.no_app_to_open, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) {
            webView.loadUrl(intent.getData().toString());
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }
}
