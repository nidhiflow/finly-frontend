import { useEffect } from 'react';

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const role = el.getAttribute?.('role');
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.isContentEditable) return true;
  if (role === 'textbox' || role === 'searchbox') return true;
  return false;
}

/**
 * Registers global keyboard shortcuts.
 * @param {{ onAddTransaction?: () => void, onShowShortcuts?: () => void }} callbacks
 */
export function useKeyboardShortcuts({ onAddTransaction, onShowShortcuts }) {
  useEffect(() => {
    const handler = (e) => {
      if (isInputFocused()) return;

      // N or Ctrl+N / Cmd+N — Add transaction
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onAddTransaction?.();
      }

      // ? (Shift+?) — Show shortcuts help
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        onShowShortcuts?.();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onAddTransaction, onShowShortcuts]);
}
