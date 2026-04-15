import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

import Button from '../components/Button.svelte';

// Components that DON'T require children snippet
import Spinner from '../components/Spinner.svelte';
import Toggle from '../components/Toggle.svelte';
import Textarea from '../components/Textarea.svelte';
import Slider from '../components/Slider.svelte';
import Input from '../components/Input.svelte';
import SearchInput from '../components/SearchInput.svelte';
import Skeleton from '../components/Skeleton.svelte';
import ThemeSwitcher from '../components/ThemeSwitcher.svelte';

const textSnippet = (text: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));

describe('Button', () => {
  it('renders with children', () => {
    render(Button, { props: { children: textSnippet('Click me') } });
    expect(screen.getByRole('button', { name: /Click me/ })).toBeTruthy();
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders variant=%s',
    (variant) => {
      render(Button, { props: { variant, children: textSnippet('Test') } });
      const btn = screen.getByRole('button');
      expect(btn.classList.contains(`variant-${variant}`)).toBe(true);
    },
  );

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    render(Button, { props: { size, children: textSnippet('Test') } });
    const btn = screen.getByRole('button');
    expect(btn.classList.contains(`size-${size}`)).toBe(true);
  });

  it('renders disabled state', () => {
    render(Button, { props: { disabled: true, children: textSnippet('Nope') } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading state', () => {
    render(Button, { props: { loading: true, children: textSnippet('Wait') } });
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.spinner')).toBeTruthy();
  });
});

describe('Spinner', () => {
  it('renders with default props', () => {
    render(Spinner);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    render(Spinner, { props: { size } });
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('renders with default props', () => {
    render(Toggle);
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('renders with label', () => {
    render(Toggle, { props: { label: 'Dark mode' } });
    expect(screen.getByText('Dark mode')).toBeTruthy();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    render(Toggle, { props: { size } });
    expect(screen.getByRole('switch')).toBeTruthy();
  });
});

describe('Textarea', () => {
  it('renders with default props', () => {
    render(Textarea);
    expect(document.querySelector('textarea')).toBeTruthy();
  });

  it('renders with label and error', () => {
    render(Textarea, { props: { label: 'Description', error: 'Required' } });
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });
});

describe('Slider', () => {
  it('renders with default props', () => {
    render(Slider);
    expect(document.querySelector('input[type="range"]')).toBeTruthy();
  });

  it('renders with label', () => {
    render(Slider, { props: { label: 'Volume', min: 0, max: 100 } });
    expect(screen.getByText('Volume')).toBeTruthy();
  });
});

describe('Input', () => {
  it('renders with default props', () => {
    render(Input);
    expect(document.querySelector('input')).toBeTruthy();
  });

  it('renders with label and hint', () => {
    render(Input, { props: { label: 'Email', hint: 'Enter email' } });
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Enter email')).toBeTruthy();
  });

  it('renders error instead of hint when both provided', () => {
    render(Input, { props: { label: 'Email', hint: 'Enter email', error: 'Invalid' } });
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Invalid')).toBeTruthy();
  });
});

describe('SearchInput', () => {
  it('renders with default props', () => {
    render(SearchInput);
    expect(document.querySelector('input')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('.ui-skeleton')).toBeTruthy();
  });

  it.each(['text', 'circular', 'rectangular'] as const)('renders variant=%s', (variant) => {
    const { container } = render(Skeleton, { props: { variant } });
    expect(container.querySelector('.ui-skeleton')).toBeTruthy();
  });
});

describe('ThemeSwitcher', () => {
  it('renders', () => {
    render(ThemeSwitcher);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
