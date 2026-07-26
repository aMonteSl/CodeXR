// == virtualScreenRuntime.js | relayTransport (assembled per manifest.json; see COMPONENTS.md) ==
    // Media path for viewers that peer-to-peer cannot reach. Across networks
    // the two browsers sit behind different NATs and, with no TURN server,
    // ICE never connects — so the encoded frames travel over the broadcast
    // WebSocket, which every guest can already reach through the tunnel.
    //
    // Wire format (mirrored by screenBroadcastSignalingServer.ts):
    //   byte 0-1  magic 'CX'   byte 2  version
    //   byte 3    (temporalLayer << 4) | kind
    //   byte 4-11 timestamp (microseconds, big-endian)  then payload
    // The layer rides in the spare nibble so the server can thin the stream
    // per viewer without the frame growing or being decoded.
    const RELAY_HEADER_BYTES = 12;
    const RELAY_MAGIC_0 = 0x43;
    const RELAY_MAGIC_1 = 0x58;
    const RELAY_VERSION = 2;
    const RELAY_KIND_MASK = 0x0f;
    const RELAY_LAYER_SHIFT = 4;
    const RELAY_KIND = {
      videoKey: 1,
      videoDelta: 2,
      audio: 3,
      videoImage: 4,
      audioConfig: 5,
    };
    const RELAY_AUDIO_BITRATE = 64000;
    const RELAY_KEYFRAME_INTERVAL_MS = 2000;
    const RELAY_IMAGE_FPS = 8;
    const RELAY_IMAGE_QUALITY = 0.6;
    /**
     * One encoding serves every viewer, so its quality has to fit what the
     * host's uplink can carry for the whole audience: each remote viewer costs
     * another copy of this bitrate. Descending tiers, with a floor — below it
     * the picture stops being useful, so the status warns instead.
     */
    const RELAY_QUALITY_TIERS = [
      { maxViewers: 2, bitrate: 1500000, width: 1280, framerate: 24 },
      { maxViewers: 6, bitrate: 800000, width: 960, framerate: 24 },
      { maxViewers: 14, bitrate: 500000, width: 768, framerate: 18 },
      { maxViewers: Infinity, bitrate: 350000, width: 640, framerate: 12 },
    ];

    function relayQualityForAudience(viewerCount) {
      const audience = Math.max(1, viewerCount || 1);
      return RELAY_QUALITY_TIERS.find(function (tier) {
        return audience <= tier.maxViewers;
      }) || RELAY_QUALITY_TIERS[RELAY_QUALITY_TIERS.length - 1];
    }

    function hasWebCodecs() {
      return typeof win.VideoEncoder === 'function'
        && typeof win.VideoDecoder === 'function'
        && typeof win.MediaStreamTrackProcessor === 'function';
    }

    function hasAudioCodecs() {
      return typeof win.AudioEncoder === 'function' && typeof win.AudioDecoder === 'function';
    }

    function buildRelayFrame(kind, timestamp, payload, temporalLayer) {
      const body = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      const frame = new Uint8Array(RELAY_HEADER_BYTES + body.byteLength);
      const view = new DataView(frame.buffer);
      const layer = Math.min(15, Math.max(0, temporalLayer || 0));
      frame[0] = RELAY_MAGIC_0;
      frame[1] = RELAY_MAGIC_1;
      frame[2] = RELAY_VERSION;
      frame[3] = (layer << RELAY_LAYER_SHIFT) | (kind & RELAY_KIND_MASK);
      view.setBigUint64(4, BigInt(Math.max(0, Math.round(timestamp || 0))));
      frame.set(body, RELAY_HEADER_BYTES);
      return frame;
    }

    function readRelayFrame(buffer) {
      const bytes = new Uint8Array(buffer);
      if (bytes.byteLength < RELAY_HEADER_BYTES) {
        return null;
      }
      if (bytes[0] !== RELAY_MAGIC_0 || bytes[1] !== RELAY_MAGIC_1 || bytes[2] !== RELAY_VERSION) {
        return null;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {
        kind: bytes[3] & RELAY_KIND_MASK,
        temporalLayer: bytes[3] >> RELAY_LAYER_SHIFT,
        timestamp: Number(view.getBigUint64(4)),
        payload: bytes.subarray(RELAY_HEADER_BYTES),
      };
    }

    function sendRelayFrame(kind, timestamp, payload, temporalLayer) {
      const socket = refs.signalingSocket;
      if (!socket || socket.readyState !== win.WebSocket.OPEN) {
        return false;
      }
      socket.send(buildRelayFrame(kind, timestamp, payload, temporalLayer));
      return true;
    }

    // ── Sender ───────────────────────────────────────────────────────────────

    function startRelaySender(message) {
      // One encoder serves the whole audience: a second viewer never starts a
      // second encoding, it only asks for a keyframe.
      if (refs.relaySender || state.streamSourceType !== 'local' || !state.stream) {
        return;
      }
      const videoTrack = state.stream.getVideoTracks?.()[0] || null;
      if (!videoTrack) {
        return;
      }

      const sender = {
        stopped: false,
        videoEncoder: null,
        audioEncoder: null,
        readers: [],
        imageTimer: null,
        scaleCanvas: null,
        lastKeyframeAt: 0,
        keyframeRequested: true,
        audience: Math.max(1, message?.relayViewerCount || 1),
        quality: null,
        temporalLayers: false,
      };
      refs.relaySender = sender;
      sender.quality = relayQualityForAudience(sender.audience);

      if (hasWebCodecs()) {
        startEncodedVideoPump(sender, videoTrack);
        const audioTrack = state.stream.getAudioTracks?.()[0] || null;
        if (audioTrack && hasAudioCodecs()) {
          startEncodedAudioPump(sender, audioTrack);
        }
      } else {
        // No WebCodecs (Firefox, Safari): send whole images instead. Audio
        // cannot ride this path, and the status says so rather than pretending.
        startImagePump(sender);
      }

      updateStatus(describeRelayBroadcast(sender));
    }

    function stopRelaySender() {
      const sender = refs.relaySender;
      if (!sender) {
        return;
      }
      refs.relaySender = null;
      sender.stopped = true;
      if (sender.imageTimer) {
        win.clearInterval(sender.imageTimer);
      }
      sender.readers.forEach(function (reader) {
        try {
          reader.cancel();
        } catch (_error) {
          // The track already ended.
        }
      });
      [sender.videoEncoder, sender.audioEncoder].forEach(function (encoder) {
        try {
          if (encoder && encoder.state !== 'closed') {
            encoder.close();
          }
        } catch (_error) {
          // Encoder already torn down.
        }
      });
    }

    function requestRelayKeyframe() {
      if (refs.relaySender) {
        refs.relaySender.keyframeRequested = true;
      }
    }

    /**
     * The audience changed. One encoding still serves everybody; what changes
     * is the quality it is worth encoding at, because every remote viewer costs
     * the host another copy of this bitrate.
     */
    function updateRelayAudience(message) {
      const sender = refs.relaySender;
      if (!sender) {
        return;
      }
      sender.audience = Math.max(1, message?.relayViewerCount || 1);
      sender.quality = relayQualityForAudience(sender.audience);
      updateStatus(describeRelayBroadcast(sender));
    }

    function describeRelayBroadcast(sender) {
      const viewers = sender.audience;
      const audio = sender.audioEncoder ? sender.quality.bitrate + RELAY_AUDIO_BITRATE : sender.quality.bitrate;
      const upstreamMbps = (audio * viewers) / 1000000;
      const people = viewers === 1 ? '1 remote viewer' : `${viewers} remote viewers`;
      const cost = `~${upstreamMbps.toFixed(1)} Mbps up`;
      const quality = sender.temporalLayers ? '' : ' · single layer';
      return `${refs.config.labels.broadcasting} · ${people} · ${cost}${quality}`;
    }

    function scaleFrameIfNeeded(sender, frame) {
      const maxWidth = sender.quality.width;
      const width = frame.displayWidth || frame.codedWidth || 0;
      if (!width || width <= maxWidth || typeof win.OffscreenCanvas !== 'function') {
        return { frame, scaled: false };
      }
      const height = frame.displayHeight || frame.codedHeight || 0;
      const targetWidth = maxWidth - (maxWidth % 2);
      const targetHeight = Math.max(2, Math.round((height * targetWidth) / width) & ~1);
      if (!sender.scaleCanvas
        || sender.scaleCanvas.width !== targetWidth
        || sender.scaleCanvas.height !== targetHeight) {
        sender.scaleCanvas = new win.OffscreenCanvas(targetWidth, targetHeight);
      }
      const context = sender.scaleCanvas.getContext('2d');
      context.drawImage(frame, 0, 0, targetWidth, targetHeight);
      const scaledFrame = new win.VideoFrame(sender.scaleCanvas, { timestamp: frame.timestamp });
      return { frame: scaledFrame, scaled: true };
    }

    function buildVideoEncoderConfig(sender, rawFrame, withTemporalLayers) {
      const maxWidth = sender.quality.width;
      const sourceWidth = rawFrame.displayWidth || maxWidth;
      const width = Math.min(sourceWidth, maxWidth) & ~1;
      const height = Math.max(2, Math.round(
        ((rawFrame.displayHeight || 720) * width) / sourceWidth,
      ) & ~1);
      const config = {
        codec: 'vp8',
        width,
        height,
        bitrate: sender.quality.bitrate,
        framerate: sender.quality.framerate,
        latencyMode: 'realtime',
      };
      if (withTemporalLayers) {
        // Three temporal layers from a single encoding: the server can drop
        // the top ones for a viewer that falls behind, and only that viewer
        // loses frame rate.
        config.scalabilityMode = 'L1T3';
      }
      return config;
    }

    async function resolveVideoEncoderConfig(sender, rawFrame) {
      const layered = buildVideoEncoderConfig(sender, rawFrame, true);
      try {
        const support = await win.VideoEncoder.isConfigSupported(layered);
        if (support?.supported) {
          sender.temporalLayers = true;
          return layered;
        }
      } catch (_error) {
        // Older implementations reject unknown scalability modes outright.
      }
      sender.temporalLayers = false;
      return buildVideoEncoderConfig(sender, rawFrame, false);
    }

    function startEncodedVideoPump(sender, videoTrack) {
      const encoder = new win.VideoEncoder({
        output: function (chunk, metadata) {
          const payload = new Uint8Array(chunk.byteLength);
          chunk.copyTo(payload);
          sendRelayFrame(
            chunk.type === 'key' ? RELAY_KIND.videoKey : RELAY_KIND.videoDelta,
            chunk.timestamp,
            payload,
            metadata?.svc?.temporalLayerId || 0,
          );
        },
        error: function () {
          stopRelaySender();
        },
      });
      sender.videoEncoder = encoder;

      const processor = new win.MediaStreamTrackProcessor({ track: videoTrack });
      const reader = processor.readable.getReader();
      sender.readers.push(reader);

      void (async function pump() {
        while (!sender.stopped) {
          const { value: rawFrame, done } = await reader.read();
          if (done || !rawFrame) {
            break;
          }
          try {
            if (encoder.state !== 'configured') {
              encoder.configure(await resolveVideoEncoderConfig(sender, rawFrame));
              sender.appliedQuality = sender.quality;
            } else if (sender.appliedQuality !== sender.quality) {
              // The audience changed: reconfigure this same encoder instead of
              // starting another one, and resync viewers with a keyframe.
              encoder.configure(buildVideoEncoderConfig(sender, rawFrame, sender.temporalLayers));
              sender.appliedQuality = sender.quality;
              sender.keyframeRequested = true;
            }
            // Encoding is the slow part: skip frames instead of queueing them,
            // so a busy machine falls behind in fluidity, never in latency.
            if (encoder.encodeQueueSize > 2) {
              continue;
            }
            const now = win.Date.now();
            const keyFrame = sender.keyframeRequested
              || (now - sender.lastKeyframeAt) >= RELAY_KEYFRAME_INTERVAL_MS;
            if (keyFrame) {
              sender.keyframeRequested = false;
              sender.lastKeyframeAt = now;
            }
            const scaled = scaleFrameIfNeeded(sender, rawFrame);
            encoder.encode(scaled.frame, { keyFrame });
            if (scaled.scaled) {
              scaled.frame.close();
            }
          } catch (_error) {
            // A frame that cannot be encoded is dropped, not fatal.
          } finally {
            rawFrame.close();
          }
        }
      })();
    }

    function startEncodedAudioPump(sender, audioTrack) {
      const settings = typeof audioTrack.getSettings === 'function' ? audioTrack.getSettings() : {};
      const sampleRate = settings.sampleRate || 48000;
      const channels = settings.channelCount || 2;

      const encoder = new win.AudioEncoder({
        output: function (chunk) {
          const payload = new Uint8Array(chunk.byteLength);
          chunk.copyTo(payload);
          sendRelayFrame(RELAY_KIND.audio, chunk.timestamp, payload);
        },
        error: function () {
          // Losing audio must not take the picture down with it.
          try {
            sender.audioEncoder?.close();
          } catch (_error) {
            // Already closed.
          }
          sender.audioEncoder = null;
        },
      });
      sender.audioEncoder = encoder;
      encoder.configure({
        codec: 'opus',
        sampleRate,
        numberOfChannels: channels,
        bitrate: RELAY_AUDIO_BITRATE,
      });

      // The decoder needs the same parameters before the first packet.
      sendRelayFrame(
        RELAY_KIND.audioConfig,
        0,
        new win.TextEncoder().encode(JSON.stringify({ sampleRate, channels })),
      );

      const processor = new win.MediaStreamTrackProcessor({ track: audioTrack });
      const reader = processor.readable.getReader();
      sender.readers.push(reader);

      void (async function pump() {
        while (!sender.stopped) {
          const { value: audioData, done } = await reader.read();
          if (done || !audioData) {
            break;
          }
          try {
            if (encoder.state === 'configured') {
              encoder.encode(audioData);
            }
          } catch (_error) {
            // Drop this slice of audio.
          } finally {
            audioData.close();
          }
        }
      })();
    }

    function startImagePump(sender) {
      const video = ensureVideoSource();
      const document = getDocument();
      if (!video || !document) {
        return;
      }
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      sender.imageTimer = win.setInterval(function () {
        if (sender.stopped || !video.videoWidth) {
          return;
        }
        // The image path has no layers to thin, so the audience tier is the
        // only lever it has: a bigger audience gets a smaller picture.
        const width = Math.min(video.videoWidth, sender.quality.width);
        const height = Math.round((video.videoHeight * width) / video.videoWidth);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.drawImage(video, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          if (!blob || sender.stopped) {
            return;
          }
          void blob.arrayBuffer().then(function (buffer) {
            if (!sender.stopped) {
              sendRelayFrame(RELAY_KIND.videoImage, win.Date.now() * 1000, buffer);
            }
          });
        }, 'image/jpeg', RELAY_IMAGE_QUALITY);
      }, Math.round(1000 / RELAY_IMAGE_FPS));
    }

    // ── Receiver ─────────────────────────────────────────────────────────────

    function startRelayReceiver(message) {
      stopRelayReceiver();
      const document = getDocument();
      if (!document) {
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      // A canvas-backed MediaStream drops straight into the existing video
      // texture, so nothing downstream knows the media came from the relay.
      const stream = typeof canvas.captureStream === 'function' ? canvas.captureStream(30) : null;
      if (!stream) {
        return;
      }

      const receiver = {
        canvas,
        context,
        stream,
        videoDecoder: null,
        audioDecoder: null,
        audioContext: null,
        audioDestination: null,
        audioPlayhead: 0,
        sized: false,
        live: false,
        hasAudio: message?.hasAudio === true,
      };
      refs.relayReceiver = receiver;

      if (receiver.hasAudio && typeof win.AudioContext === 'function') {
        // Created upfront: a track added after the stream is attached would
        // never reach the audio element.
        receiver.audioContext = new win.AudioContext();
        receiver.audioDestination = receiver.audioContext.createMediaStreamDestination();
        const audioTrack = receiver.audioDestination.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }

      setBroadcastState('viewer', 'connecting');
      updateStatus(refs.config.labels.connecting);
    }

    function stopRelayReceiver() {
      const receiver = refs.relayReceiver;
      if (!receiver) {
        return;
      }
      refs.relayReceiver = null;
      [receiver.videoDecoder, receiver.audioDecoder].forEach(function (decoder) {
        try {
          if (decoder && decoder.state !== 'closed') {
            decoder.close();
          }
        } catch (_error) {
          // Already closed.
        }
      });
      try {
        void receiver.audioContext?.close();
      } catch (_error) {
        // Already closed.
      }
      receiver.stream.getTracks().forEach(function (track) {
        track.stop();
      });
    }

    function handleRelayFrame(buffer) {
      const receiver = refs.relayReceiver;
      const frame = receiver ? readRelayFrame(buffer) : null;
      if (!frame) {
        return;
      }

      switch (frame.kind) {
        case RELAY_KIND.videoKey:
        case RELAY_KIND.videoDelta:
          decodeRelayVideo(receiver, frame);
          return;
        case RELAY_KIND.videoImage:
          drawRelayImage(receiver, frame);
          return;
        case RELAY_KIND.audioConfig:
          configureRelayAudio(receiver, frame);
          return;
        case RELAY_KIND.audio:
          decodeRelayAudio(receiver, frame);
          return;
        default:
          return;
      }
    }

    function ensureRelayVideoDecoder(receiver) {
      if (receiver.videoDecoder) {
        return receiver.videoDecoder;
      }
      if (typeof win.VideoDecoder !== 'function') {
        return null;
      }
      const decoder = new win.VideoDecoder({
        output: function (videoFrame) {
          try {
            paintRelayFrame(receiver, videoFrame, videoFrame.displayWidth, videoFrame.displayHeight);
          } finally {
            videoFrame.close();
          }
        },
        error: function () {
          // A broken decoder recovers on the next keyframe.
          try {
            receiver.videoDecoder?.close();
          } catch (_error) {
            // Already closed.
          }
          receiver.videoDecoder = null;
        },
      });
      decoder.configure({ codec: 'vp8', optimizeForLatency: true });
      receiver.videoDecoder = decoder;
      return decoder;
    }

    function decodeRelayVideo(receiver, frame) {
      const decoder = ensureRelayVideoDecoder(receiver);
      if (!decoder || decoder.state !== 'configured') {
        return;
      }
      const isKey = frame.kind === RELAY_KIND.videoKey;
      // Deltas before the first keyframe cannot be decoded; waiting for one
      // is normal when joining a broadcast already in progress.
      if (!isKey && !receiver.keyframeSeen) {
        return;
      }
      if (isKey) {
        receiver.keyframeSeen = true;
      }
      try {
        decoder.decode(new win.EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          timestamp: frame.timestamp,
          data: frame.payload,
        }));
      } catch (_error) {
        receiver.keyframeSeen = false;
      }
    }

    function drawRelayImage(receiver, frame) {
      if (typeof win.createImageBitmap !== 'function') {
        return;
      }
      const blob = new win.Blob([frame.payload], { type: 'image/jpeg' });
      void win.createImageBitmap(blob).then(function (bitmap) {
        try {
          paintRelayFrame(receiver, bitmap, bitmap.width, bitmap.height);
        } finally {
          bitmap.close?.();
        }
      }).catch(function () {
        // Skip an image that failed to decode.
      });
    }

    function paintRelayFrame(receiver, source, width, height) {
      if (refs.relayReceiver !== receiver) {
        return;
      }
      if (width && height && (receiver.canvas.width !== width || receiver.canvas.height !== height)) {
        receiver.canvas.width = width;
        receiver.canvas.height = height;
      }
      receiver.context.drawImage(source, 0, 0, receiver.canvas.width, receiver.canvas.height);
      markRelayLive(receiver);
    }

    /**
     * The viewer only counts as live once a real frame has been painted —
     * announcing it earlier is what used to leave people staring at black.
     */
    function markRelayLive(receiver) {
      if (receiver.live) {
        return;
      }
      receiver.live = true;
      releaseStream(false);
      state.stream = receiver.stream;
      state.streamSourceType = 'remote';
      state.hasAudio = receiver.hasAudio;
      state.currentSourceLabel = refs.config.labels.receiving;
      state.presentationMode = 'expanded';
      setBroadcastState('viewer', 'live');
      updateVideoSource(receiver.stream);
      setMode('viewing', refs.config.labels.receiving);
      showChrome();
    }

    function configureRelayAudio(receiver, frame) {
      if (!receiver.audioContext || typeof win.AudioDecoder !== 'function' || receiver.audioDecoder) {
        return;
      }
      let config = null;
      try {
        config = JSON.parse(new win.TextDecoder().decode(frame.payload));
      } catch (_error) {
        return;
      }

      const decoder = new win.AudioDecoder({
        output: function (audioData) {
          try {
            playRelayAudio(receiver, audioData);
          } finally {
            audioData.close();
          }
        },
        error: function () {
          receiver.audioDecoder = null;
        },
      });
      decoder.configure({
        codec: 'opus',
        sampleRate: config.sampleRate || 48000,
        numberOfChannels: config.channels || 2,
      });
      receiver.audioDecoder = decoder;
    }

    function decodeRelayAudio(receiver, frame) {
      const decoder = receiver.audioDecoder;
      if (!decoder || decoder.state !== 'configured') {
        return;
      }
      try {
        decoder.decode(new win.EncodedAudioChunk({
          type: 'key',
          timestamp: frame.timestamp,
          data: frame.payload,
        }));
      } catch (_error) {
        // Drop this slice of audio.
      }
    }

    function playRelayAudio(receiver, audioData) {
      const context = receiver.audioContext;
      const destination = receiver.audioDestination;
      if (!context || !destination) {
        return;
      }

      const channels = audioData.numberOfChannels;
      const frames = audioData.numberOfFrames;
      const buffer = context.createBuffer(channels, frames, audioData.sampleRate);
      for (let channel = 0; channel < channels; channel += 1) {
        const samples = new Float32Array(frames);
        audioData.copyTo(samples, { planeIndex: channel, format: 'f32-planar' });
        buffer.copyToChannel(samples, channel);
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      // A small jitter cushion: scheduling exactly at currentTime would click
      // on every late packet.
      const startAt = Math.max(context.currentTime + 0.06, receiver.audioPlayhead);
      source.start(startAt);
      receiver.audioPlayhead = startAt + buffer.duration;
    }
