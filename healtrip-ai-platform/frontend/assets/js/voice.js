/* HealTrip voice layer.
 *
 * A browser recognition session ending is not the same thing as a person
 * finishing their sentence. This module separates the two: recognition is a
 * transport, and a turn manager decides when a turn is actually over.
 *
 *   IDLE → LISTENING → SPEECH → PAUSE → SPEECH → … → FINALIZING → IDLE
 *                                 │
 *                                 └─ silence long enough, or "I'm finished"
 *
 * Thresholds live in VOICE_CONFIG so they can be tuned without touching logic.
 * Nothing clinical happens here: the finalized transcript is handed back and the
 * caller sends it through the usual safety gate and engine.
 */

const VOICE_CONFIG = {
  // A pause shorter than this is just breathing.
  INITIAL_SILENCE_MS: 3200,
  // If the person spoke recently or the sentence looks unfinished, wait longer.
  EXTENDED_SILENCE_MS: 5200,
  // Hard ceilings so a forgotten microphone does not run forever.
  MAX_TURN_MS: 120000,
  MAX_TURN_EXTENSION_MS: 60000,
  // Recognition sessions end on their own; restart quietly while the turn lives.
  RESTART_DELAY_MS: 250,
  // A breath before the assistant speaks, so it does not feel mechanical.
  PAUSE_BEFORE_RESPONSE_MS: 450,
  SPEECH_RATE: 0.95,
  SPEECH_PITCH: 1,
  SPEECH_VOLUME: 1,
};

const UNFINISHED_ENDINGS = [
  'and', 'but', 'because', 'so', 'the', 'a', 'to', 'for', 'with', 'about', 'since', 'when', 'if', 'my', 'it',
  'و', 'أو', 'لكن', 'لأن', 'من', 'في', 'على', 'عن', 'مع', 'منذ', 'إذا',
];

function looksUnfinished(text) {
  const words = String(text || '').trim().split(/\s+/);
  const last = (words[words.length - 1] || '').toLowerCase().replace(/[.,!?؟،]/g, '');
  return words.length > 0 && UNFINISHED_ENDINGS.includes(last);
}

class TurnManager {
  constructor({ lang = 'en', onState, onInterim, onFinal, onError } = {}) {
    this.lang = lang;
    this.onState = onState || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onError = onError || (() => {});

    this.state = 'IDLE';
    this.finalChunks = [];
    this.interim = '';
    this.recognition = null;
    this.silenceTimer = null;
    this.turnTimer = null;
    this.turnStarted = 0;
    this.lastSpeechAt = 0;
    this.wantsListening = false;
  }

  static supported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.onState(next);
  }

  transcript() {
    return [...this.finalChunks, this.interim].join(' ').replace(/\s+/g, ' ').trim();
  }

  start() {
    if (!TurnManager.supported()) {
      this.onError('unsupported');
      return false;
    }
    if (this.wantsListening) return true;

    this.wantsListening = true;
    this.finalChunks = [];
    this.interim = '';
    this.turnStarted = Date.now();
    this.lastSpeechAt = Date.now();
    this.setState('LISTENING');
    this.openSession();

    this.turnTimer = setTimeout(() => this.finalize('max_duration'), VOICE_CONFIG.MAX_TURN_MS + VOICE_CONFIG.MAX_TURN_EXTENSION_MS);
    return true;
  }

  openSession() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = this.lang === 'ar' ? 'ar-SA' : 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) this.finalChunks.push(text.trim());
        else interim += text;
      }
      this.interim = interim.trim();
      this.lastSpeechAt = Date.now();
      this.setState(this.interim || this.finalChunks.length ? 'SPEECH' : 'LISTENING');
      this.onInterim(this.transcript());
      this.armSilenceTimer();
    };

    // A session ending is a transport event, not the end of a turn.
    recognition.onend = () => {
      if (!this.wantsListening) return;
      setTimeout(() => {
        if (this.wantsListening) {
          try { recognition.start(); } catch (_) { this.openSession(); }
        }
      }, VOICE_CONFIG.RESTART_DELAY_MS);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return; // normal, keep waiting
      this.onError(event.error === 'not-allowed' ? 'denied' : 'failed');
      this.stop(false);
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (_) {
      /* a session was already open */
    }
  }

  /**
   * Decides how long to keep waiting. An unfinished-sounding sentence, or speech
   * in the last couple of seconds, buys more time.
   */
  armSilenceTimer() {
    clearTimeout(this.silenceTimer);
    const text = this.transcript();
    const wait = looksUnfinished(text) || Date.now() - this.turnStarted < 4000
      ? VOICE_CONFIG.EXTENDED_SILENCE_MS
      : VOICE_CONFIG.INITIAL_SILENCE_MS;

    this.setState('PAUSE');
    this.silenceTimer = setTimeout(() => {
      const quietFor = Date.now() - this.lastSpeechAt;
      if (quietFor < wait - 200) {
        this.armSilenceTimer();
        return;
      }
      if (!this.transcript()) {
        this.setState('LISTENING');
        return;
      }
      this.finalize('silence');
    }, wait);
  }

  /** The explicit "I'm finished" button, and the only immediate path. */
  finishNow() {
    if (!this.wantsListening) return;
    this.finalize('manual');
  }

  finalize(reason) {
    if (!this.wantsListening) return;
    const text = this.transcript();
    this.stop(false);
    this.setState('FINALIZING');
    if (!text) {
      this.setState('IDLE');
      return;
    }
    this.onFinal(text, reason);
    this.setState('IDLE');
  }

  stop(emitIdle = true) {
    this.wantsListening = false;
    clearTimeout(this.silenceTimer);
    clearTimeout(this.turnTimer);
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) { /* already stopped */ }
      this.recognition.onend = null;
      this.recognition = null;
    }
    if (emitIdle) this.setState('IDLE');
  }
}

/**
 * Speaking, with barge-in: if the person starts talking, the assistant stops.
 */
const Speaker = {
  speaking: false,
  speak(text, lang = 'en', onDone) {
    if (!window.speechSynthesis || !text) {
      if (onDone) onDone();
      return;
    }
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-GB';
      utterance.rate = VOICE_CONFIG.SPEECH_RATE;
      utterance.pitch = VOICE_CONFIG.SPEECH_PITCH;
      utterance.volume = VOICE_CONFIG.SPEECH_VOLUME;
      utterance.onend = () => {
        Speaker.speaking = false;
        if (onDone) onDone();
      };
      Speaker.speaking = true;
      window.speechSynthesis.speak(utterance);
    }, VOICE_CONFIG.PAUSE_BEFORE_RESPONSE_MS);
  },
  stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    Speaker.speaking = false;
  },
};

window.HealTripVoice = { TurnManager, Speaker, VOICE_CONFIG, looksUnfinished };
