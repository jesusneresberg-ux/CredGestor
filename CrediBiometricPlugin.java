package com.credigestor.app;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Local session unlock only. Passwords and biometric templates never cross this bridge. */
@CapacitorPlugin(name = "CrediBiometric")
public class CrediBiometricPlugin extends Plugin {
    private PluginCall pending;
    private BiometricPrompt prompt;

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String url = getBridge().getWebView().getUrl();
            if (url == null || !"https://credigestor-testes.web.app".equals(android.net.Uri.parse(url).getScheme() + "://" + android.net.Uri.parse(url).getHost())) {
                call.reject("Origem não autorizada."); return;
            }
            if (pending != null) { call.reject("Já existe uma verificação em andamento."); return; }
            if (BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("Cadastre uma biometria compatível nas configurações do aparelho ou entre com e-mail e senha."); return;
            }
            pending = call;
            prompt = new BiometricPrompt(getActivity(), ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    PluginCall current = pending; pending = null;
                    if (current != null) current.resolve();
                }
                @Override public void onAuthenticationError(int code, CharSequence message) {
                    PluginCall current = pending; pending = null;
                    if (current != null) current.reject(message.toString());
                }
            });
            prompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear CrediGestor")
                .setSubtitle("Confirme a biometria cadastrada neste aparelho")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Usar e-mail e senha").build());
        });
    }

    @Override protected void handleOnDestroy() {
        if (prompt != null) prompt.cancelAuthentication();
        super.handleOnDestroy();
    }
}
