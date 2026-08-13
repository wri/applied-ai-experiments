import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';

import TokenCounter from '../components/TokenCounter.svelte';
import StreamingText from '../components/StreamingText.svelte';
import ChatMessage from '../components/ChatMessage.svelte';
import CostDisplay from '../components/CostDisplay.svelte';

describe('TokenCounter', () => {
  it('renders with a number', () => {
    render(TokenCounter, { props: { tokens: 1500 } });
    expect(screen.getByText(/1\.5K/)).toBeTruthy();
  });

  it('renders with breakdown object', () => {
    render(TokenCounter, {
      props: { tokens: { input: 100, output: 200 }, showBreakdown: true },
    });
    expect(document.querySelector('.ui-token-counter')).toBeTruthy();
  });
});

describe('StreamingText', () => {
  it('renders with text', () => {
    const { container } = render(StreamingText, { props: { text: 'Hello world' } });
    expect(container).toBeTruthy();
  });
});

describe('ChatMessage', () => {
  it('renders user message', () => {
    render(ChatMessage, {
      props: { role: 'user', content: 'Hello' },
    });
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders assistant message', () => {
    render(ChatMessage, {
      props: { role: 'assistant', content: 'Hi there' },
    });
    expect(screen.getByText('Hi there')).toBeTruthy();
  });

  it('renders system message', () => {
    render(ChatMessage, {
      props: { role: 'system', content: 'You are helpful' },
    });
    expect(screen.getByText('You are helpful')).toBeTruthy();
  });
});

describe('CostDisplay', () => {
  it('renders with a number', () => {
    render(CostDisplay, { props: { tokens: 10000 } });
    expect(document.querySelector('.ui-cost-display')).toBeTruthy();
  });

  it('renders with token breakdown', () => {
    render(CostDisplay, {
      props: {
        tokens: { input: 5000, output: 2000 },
        showBreakdown: true,
        variant: 'detailed',
      },
    });
    expect(document.querySelector('.ui-cost-display')).toBeTruthy();
  });
});
