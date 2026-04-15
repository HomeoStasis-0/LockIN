import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

import RichCardText from '../components/RichCardText';

test('normalizes malformed arrow chains from AI output', () => {
  const input =
    'Identify an unpatched vulnerability $\\to exploit it \\\\to generate target list \\\\to infect hosts \\\\to$ repeat.';

  const { container } = render(<RichCardText text={input} />);
  const content = container.textContent ?? '';

  expect(content).toContain('Identify an unpatched vulnerability');
  expect(content).toContain('→ exploit it → generate target list → infect hosts → repeat.');
  expect(content).not.toContain('\\to');
  expect(content).not.toContain('$');
});

test('repairs malformed display math delimiters in theorem-style output', () => {
  const input =
    'For k = 1, ..., n,\n\n= \\max_{\\substack{S\\subset\\mathbb R^n \\ \\dim S = n-k+1}}\\min_{\\substack{x\\in S\\ x\\neq0}} \\frac{x^T A x}{x^T x}.$$';

  const { container } = render(<RichCardText text={input} />);
  const content = container.textContent ?? '';

  expect(content).toContain('For k = 1, ..., n,');
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
});

test('renders set-notation line with raw latex commands as math', () => {
  const input =
    'Why is the set A={f:[0,1]→\\mathbb R\\mid f(0)=0..if(t)-f(s)^4\\le t-s} compact in L^2[0,1]?';

  const { container } = render(<RichCardText text={input} />);
  const content = container.textContent ?? '';

  expect(content).toContain('Why is the set');
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
});

test('renders displaystyle/limit/integral chain without leaking latex commands', () => {
  const input =
    'For f ∈ L^p(μ) on a finite measure space, what is \\displaystyle\\lim_{n\\to\\infty}\\int |f|^{1/n}\\,d\\mu?';

  const { container } = render(<RichCardText text={input} />);
  const content = container.textContent ?? '';

  expect(content).toContain('For f');
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
});

test('renders amsmath display environments as block math', () => {
  const input = String.raw`We can write the optimization as:
\begin{align}
f(x) &= x^2 + 1 \\
g(x) &= \operatorname{sin}(x) + \sqrt x
\end{align}`;

  const { container } = render(<RichCardText text={input} />);

  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.textContent ?? '').toContain('We can write the optimization as:');
});

test('normalizes unicode math symbols into latex commands', () => {
  const input = String.raw`Let x ∈ ℝ and y ∈ ℕ, with A ⊆ B, A ≠ B, and \sqrt n ≥ 0.`;

  const { container } = render(<RichCardText text={input} />);

  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.textContent ?? '').toContain('Let x');
});

test('handles set and relation commands without explicit delimiters', () => {
  const input = String.raw`For every x \in A, we have x \subseteq B and y \operatorname{rank}(M).`;

  const { container } = render(<RichCardText text={input} />);

  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
});

test('separates inline text from mid-line display matrices', () => {
  const input = String.raw`How does the theorem imply the quadratic form x^T A x is negative for the matrix A=$$\begin{pmatrix} 0&1&0\\1&0&2\\0&2&0 \end{pmatrix}?`;

  const { container } = render(<RichCardText text={input} />);
  const content = container.textContent ?? '';

  expect(content).toContain('How does the theorem imply the quadratic form');
  expect(content).toContain('for the matrix A');
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
});
