export function triggerHaptic(type: 'light' | 'heavy' | 'success' | 'transition') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(100);
          break;
        case 'success':
          // A pleasant quick double pulse
          navigator.vibrate([30, 50, 40]);
          break;
        case 'transition':
          // Extremely subtle pulse for phase changes
          navigator.vibrate(10);
          break;
        default:
          navigator.vibrate(30);
      }
    } catch (e) {
      // Ignore vibration errors (e.g. if page is not visible or user hasn't interacted)
    }
  }
}
