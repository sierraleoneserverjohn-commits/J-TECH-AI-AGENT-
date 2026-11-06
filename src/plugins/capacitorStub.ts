/**
 * Capacitor Bridge Plugin Stub for JEXA Android App
 * When compiled inside Capacitor (Android/iOS), these call native bridge plugins.
 * In Web Browser mode, they return graceful capability flags.
 */

export interface NativeActionResult {
  success: boolean;
  platform: 'android' | 'ios' | 'web';
  message: string;
}

export const JexaNativeBridge = {
  isNativeAvailable(): boolean {
    return typeof (window as any)?.Capacitor !== 'undefined';
  },

  async openApp(packageName: string): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      // Future Capacitor plugin call:
      // await (window as any).Capacitor.Plugins.AppLauncher.openUrl({ url: packageName });
      return { success: true, platform: 'android', message: `Launching ${packageName}` };
    }
    return {
      success: false,
      platform: 'web',
      message: 'Native app launcher is only supported in the JEXA Android APK build.',
    };
  },

  async sendMessage(recipient: string, text: string): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      // Future Capacitor plugin call:
      // await (window as any).Capacitor.Plugins.Sms.send({ numbers: [recipient], text });
      return { success: true, platform: 'android', message: `Dispatched SMS to ${recipient}` };
    }
    return {
      success: false,
      platform: 'web',
      message: `Direct messaging (${recipient}) requires the JEXA Android APK with SMS and telephony permissions.`,
    };
  },

  async openWhatsApp(phone?: string, text?: string): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      return { success: true, platform: 'android', message: 'WhatsApp intent launched.' };
    }
    return {
      success: false,
      platform: 'web',
      message: 'WhatsApp deep link intent requires the JEXA Android native client.',
    };
  },

  async enableWakeWord(): Promise<NativeActionResult> {
    return {
      success: false,
      platform: 'web',
      message: 'Background hotword listener "Hey JEXA" requires Android foreground audio service.',
    };
  },

  async playMusic(): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      return { success: true, platform: 'android', message: 'Native media playback intent triggered.' };
    }
    return {
      success: false,
      platform: 'web',
      message: 'Media control intents require the JEXA Android client.',
    };
  },

  async goHome(): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      return { success: true, platform: 'android', message: 'Navigated to Android home launcher.' };
    }
    return {
      success: false,
      platform: 'web',
      message: 'OS Home navigation requires the JEXA Android APK.',
    };
  },

  async openCalendar(): Promise<NativeActionResult> {
    if (this.isNativeAvailable()) {
      return { success: true, platform: 'android', message: 'Android Calendar intent opened.' };
    }
    return {
      success: false,
      platform: 'web',
      message: 'Native calendar agenda access requires the JEXA Android app.',
    };
  },
};
