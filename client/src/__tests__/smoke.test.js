/**
 * Toolchain smoke test — client unit/integration layer.
 *
 * This spec asserts nothing about product behaviour. Its only job is to prove
 * that the runner itself is wired correctly, so that when a real spec from
 * AUDIT.md §8 fails, we know the failure is the app's fault and not the
 * harness's. It checks the four things every later spec depends on:
 *
 *   1. Jest runs at all (via `craco test`, using react-scripts' bundled Jest).
 *   2. React 19 + @testing-library/react can render and query a component.
 *   3. jest-dom matchers are loaded (from src/setupTests.js).
 *   4. Real application source under src/ resolves and imports.
 *
 * See TESTING.md for how to run this layer.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SP_NEXT_TYPE, PAGE_FORMATS } from '../constants/elementTypes';

// A trivial component defined inline — deliberately NOT an app component, so
// this spec stays green even while App.jsx is being refactored.
function Greeting({ name }) {
  return <p data-testid="greeting">Bonjour, {name}</p>;
}

describe('client test toolchain', () => {
  it('renders a component and queries it with Testing Library', () => {
    render(<Greeting name="ROOMS" />);

    const el = screen.getByTestId('greeting');

    // toBeInTheDocument comes from @testing-library/jest-dom — if setupTests.js
    // were not loaded, this line would throw "is not a function".
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('Bonjour, ROOMS');
  });

  it('resolves imports from real application source', () => {
    // constants/elementTypes.js has zero imports of its own, so this proves
    // module resolution works without dragging in the editor stack.
    expect(SP_NEXT_TYPE.character).toBe('dialogue');
    expect(PAGE_FORMATS.a4.linesPerPage).toBe(63);
  });
});
