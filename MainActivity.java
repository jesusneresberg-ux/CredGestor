package com.credigestor.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity para CredGestor
 * Versão: 2026.10.25
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Registrar plugins adicionais aqui, se necessário
        // registerPlugin(MeuPluginCustomizado.class);
    }

    @Override
    public void onBackPressed() {
        // Comportamento do botão voltar
        // Deixa o Capacitor gerenciar a navegação
        if (!getBridge().onBackPressed()) {
            super.onBackPressed();
        }
    }
}
