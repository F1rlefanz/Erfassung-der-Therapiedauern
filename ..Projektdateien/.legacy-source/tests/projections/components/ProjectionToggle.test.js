// tests/projections/components/ProjectionToggle.test.js

import { render, fireEvent } from '@testing-library/react';
import ProjectionToggle from '../../../js/projections/components/ProjectionToggle';

describe('ProjectionToggle', () => {
  test('rendert initial im ausgeschalteten Zustand', () => {
    const { container } = render(
      React.createElement(ProjectionToggle)
    );
    
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('rendert im eingeschalteten Zustand wenn initialState=true', () => {
    const { container } = render(
      React.createElement(ProjectionToggle, { initialState: true })
    );
    
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('ruft onToggle callback mit korrektem Wert auf', () => {
    const mockOnToggle = jest.fn();
    const { container } = render(
      React.createElement(ProjectionToggle, { onToggle: mockOnToggle })
    );
    
    const toggle = container.querySelector('[role="switch"]');
    fireEvent.click(toggle);
    
    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  test('ändert Zustand bei Klick', () => {
    const { container } = render(
      React.createElement(ProjectionToggle)
    );
    
    const toggle = container.querySelector('[role="switch"]');
    fireEvent.click(toggle);
    
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('enthält Info-Icon', () => {
    const { container } = render(
      React.createElement(ProjectionToggle)
    );
    
    const infoIcon = container.querySelector('[data-lucide="info"]');
    expect(infoIcon).toBeInTheDocument();
  });
});