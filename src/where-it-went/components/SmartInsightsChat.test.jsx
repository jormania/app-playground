// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SmartInsightsChat from './SmartInsightsChat';
import { askInsightsAI } from '../lib/aiParser';

vi.mock('../lib/aiParser', () => ({
  askInsightsAI: vi.fn(),
}));

/** A minimal fake SpeechRecognition — jsdom has no real one. Captures the
 * instance so a test can drive its callbacks directly. A constructor function
 * that explicitly returns an object, called with `new`, hands back that
 * object instead of `this` — no `this`-aliasing needed. */
function installFakeSpeechRecognition() {
  let instance = null;
  function FakeSpeechRecognition() {
    instance = { continuous: false, interimResults: false, lang: '', start: vi.fn(), stop: vi.fn() };
    return instance;
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
  return () => instance;
}

describe('SmartInsightsChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  afterEach(() => {
    cleanup();
  });

  it('shows an error when the API key is missing', async () => {
    render(<SmartInsightsChat transactions={[]} categories={[]} config={{}} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'what did I spend?' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('Claude API Key is missing. Please add it in Settings.')).toBeDefined();
    });
    expect(askInsightsAI).not.toHaveBeenCalled();
  });

  it('renders the answer and clears the input on success', async () => {
    askInsightsAI.mockResolvedValue('You spent **100 L** this month.');

    render(<SmartInsightsChat transactions={[]} categories={[]} config={{ claudeApiKey: 'key' }} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'what did I spend?' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText(/You spent/)).toBeDefined();
    });
    expect(screen.getByRole('textbox').value).toBe('');
  });

  it('surfaces a parser/network error from askInsightsAI', async () => {
    askInsightsAI.mockRejectedValue(new Error('API 500: internal error'));

    render(<SmartInsightsChat transactions={[]} categories={[]} config={{ claudeApiKey: 'key' }} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'what did I spend?' } });
    fireEvent.submit(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('API 500: internal error')).toBeDefined();
    });
  });

  it('sets the recognizer language from the browser locale', () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartInsightsChat transactions={[]} categories={[]} config={{ claudeApiKey: 'key' }} />);
    expect(getInstance().lang).toBe(navigator.language || 'en-US');
  });

  it('shows a clear message when the microphone permission is denied', async () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartInsightsChat transactions={[]} categories={[]} config={{ claudeApiKey: 'key' }} />);

    getInstance().onerror({ error: 'not-allowed' });

    await waitFor(() => {
      expect(screen.getByText(/Microphone access was denied/)).toBeDefined();
    });
  });

  it('stays quiet on a no-speech error rather than showing one', async () => {
    const getInstance = installFakeSpeechRecognition();
    render(<SmartInsightsChat transactions={[]} categories={[]} config={{ claudeApiKey: 'key' }} />);

    getInstance().onerror({ error: 'no-speech' });

    // Give any (incorrect) error state a chance to render before asserting its absence.
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText(/Dictation failed/)).toBeNull();
    expect(screen.queryByText(/Microphone access/)).toBeNull();
  });
});
