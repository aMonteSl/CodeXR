// == codexrCollaborationRuntime.js | disconnectScreen (assembled per manifest.json; see COMPONENTS.md) ==
    const DISCONNECT_SCREEN_COPY = {
      'host-closed': {
        title: 'Session ended',
        message: 'The host closed the session.',
      },
      removed: {
        title: 'Removed from session',
        message: 'The room host removed you from this session.',
      },
    };

    function showDisconnectScreen(reason) {
      const doc = getDocument();
      if (!doc?.body || doc.getElementById('codexrDisconnectScreen')) {
        return;
      }
      // A headset user cannot see the page while immersed.
      try {
        getScene()?.exitVR?.();
      } catch (_error) {
        // Not in VR, or the scene is already gone.
      }

      const copy = DISCONNECT_SCREEN_COPY[reason] || DISCONNECT_SCREEN_COPY['host-closed'];
      const screen = doc.createElement('div');
      screen.id = 'codexrDisconnectScreen';
      Object.assign(screen.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
        textAlign: 'center',
        background: 'radial-gradient(circle at 50% 30%, #16233c 0%, #0b1220 65%)',
        color: '#e2e8f0',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      });

      const badge = doc.createElement('div');
      badge.textContent = 'CodeXR';
      Object.assign(badge.style, {
        fontSize: '13px',
        fontWeight: '600',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#38bdf8',
      });

      const title = doc.createElement('div');
      title.textContent = copy.title;
      Object.assign(title.style, {
        fontSize: '32px',
        fontWeight: '700',
      });

      const message = doc.createElement('div');
      message.textContent = copy.message;
      Object.assign(message.style, {
        fontSize: '17px',
        color: '#94a3b8',
      });

      const hint = doc.createElement('div');
      hint.textContent = 'The connection was closed. You can close this tab.';
      Object.assign(hint.style, {
        marginTop: '8px',
        fontSize: '14px',
        color: '#64748b',
      });

      screen.appendChild(badge);
      screen.appendChild(title);
      screen.appendChild(message);
      screen.appendChild(hint);
      doc.body.appendChild(screen);
    }
