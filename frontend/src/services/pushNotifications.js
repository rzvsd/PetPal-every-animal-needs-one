import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const DEVICE_ID_KEY = 'petpal_device_id';

function getOrCreateDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

function getAppVersion() {
  return process.env.REACT_APP_VERSION || 'local';
}

function getPushPlatform() {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'ANDROID';
  if (platform === 'ios') return 'IOS';
  return 'WEB';
}

export async function initializePushNotifications({ onToken, onError }) {
  if (!Capacitor.isNativePlatform()) {
    return {
      status: 'skipped',
      reason: 'Push notifications are only registered on native builds.',
      cleanup: async () => {},
    };
  }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== 'granted') {
    return {
      status: 'denied',
      reason: 'Push notification permission was not granted.',
      cleanup: async () => {},
    };
  }

  await PushNotifications.removeAllListeners();

  const registrationListener = await PushNotifications.addListener('registration', async (token) => {
    try {
      await onToken({
        token: token.value,
        platform: getPushPlatform(),
        deviceId: getOrCreateDeviceId(),
        appVersion: getAppVersion(),
      });
    } catch (error) {
      onError?.(error);
    }
  });

  const errorListener = await PushNotifications.addListener('registrationError', (error) => {
    onError?.(new Error(error?.error || 'Push registration failed.'));
  });

  const receivedListener = await PushNotifications.addListener('pushNotificationReceived', () => {
    // Native OS UI handles foreground/background display policy. Keep this listener
    // registered so the plugin is initialized consistently on Android.
  });

  await PushNotifications.register();

  return {
    status: 'registered',
    cleanup: async () => {
      await registrationListener.remove();
      await errorListener.remove();
      await receivedListener.remove();
    },
  };
}
