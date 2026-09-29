package com.petpal.app;

import android.Manifest;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        initialPlugins.add(SafePushNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(
        name = "PushNotifications",
        permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
    )
    public static class SafePushNotificationsPlugin extends PushNotificationsPlugin {
        @Override
        @PluginMethod
        public void register(PluginCall call) {
            try {
                super.register(call);
            } catch (IllegalStateException error) {
                // Missing Firebase configuration throws natively, beyond JavaScript's try/catch.
                call.reject("Push notifications unavailable: Firebase is not configured.", "PUSH_NOT_CONFIGURED", error);
            }
        }

        @Override
        @PluginMethod
        public void unregister(PluginCall call) {
            try {
                super.unregister(call);
            } catch (IllegalStateException error) {
                call.reject("Push notifications unavailable: Firebase is not configured.", "PUSH_NOT_CONFIGURED", error);
            }
        }
    }
}
