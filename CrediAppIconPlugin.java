package com.credigestor.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "CrediAppIcon")
public class CrediAppIconPlugin extends Plugin {
    private static final String[] COLORS = {"blue", "green", "purple", "red", "orange", "gold", "cyan", "slate"};

    private boolean trusted(PluginCall call) {
        String url = getBridge().getWebView().getUrl();
        Uri uri = url == null ? Uri.EMPTY : Uri.parse(url);
        if (!"https".equals(uri.getScheme()) || !"credigestor-testes.web.app".equals(uri.getHost()) || (uri.getPort() != -1 && uri.getPort() != 443)) {
            call.reject("Origem não autorizada."); return false;
        }
        return true;
    }

    private ComponentName component(String color) {
        return new ComponentName(getContext(), getContext().getPackageName() + ".Launcher_" + color);
    }

    private String currentColor() {
        PackageManager pm = getContext().getPackageManager();
        for (String color : COLORS) {
            int state = pm.getComponentEnabledSetting(component(color));
            if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
                (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && "blue".equals(color))) return color;
        }
        return "blue";
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted(call)) return;
            try { JSObject result = new JSObject(); result.put("color", currentColor()); call.resolve(result); }
            catch (Exception error) { call.reject("Não foi possível consultar o ícone.", error); }
        });
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        final String color = call.getString("color", "");
        boolean valid = false;
        for (String option : COLORS) if (option.equals(color)) valid = true;
        if (!valid) { call.reject("Escolha uma cor de ícone disponível."); return; }
        getActivity().runOnUiThread(() -> {
            if (!trusted(call)) return;
            PackageManager pm = getContext().getPackageManager();
            String previous = currentColor();
            try {
                if (!previous.equals(color)) {
                    if (Build.VERSION.SDK_INT >= 33) {
                        List<PackageManager.ComponentEnabledSetting> changes = new ArrayList<>();
                        for (String option : COLORS) changes.add(new PackageManager.ComponentEnabledSetting(component(option),
                            option.equals(color) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                            PackageManager.DONT_KILL_APP));
                        pm.setComponentEnabledSettings(changes);
                    } else {
                        // Always enable the new launcher before disabling an existing one.
                        pm.setComponentEnabledSetting(component(color), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
                        for (String option : COLORS) if (!option.equals(color))
                            pm.setComponentEnabledSetting(component(option), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                    }
                }
                JSObject result = new JSObject(); result.put("color", color); call.resolve(result);
            } catch (Exception error) {
                // Preserve a launcher entry if a device rejects a component update.
                try { pm.setComponentEnabledSetting(component(previous), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP); } catch (Exception ignored) { }
                call.reject("Não foi possível atualizar o ícone. Tente novamente.", error);
            }
        });
    }
}
