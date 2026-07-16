// tests/projections/components/ProjectionInfo.test.js

import { render, fireEvent, screen } from '@testing-library/react';
import ProjectionInfo from '../../../js/projections/components/ProjectionInfo';

describe('ProjectionInfo', () => {
  test('rendert initial ohne sichtbaren Tooltip', () => {
    const { container } = render(
      React.createElement(ProjectionInfo, {
        method: 'linear',
        confidence: 0.7
      })
    );
    
    expect(container.querySelector('.absolute')).not.toBeInTheDocument();
  });

  test('zeigt Tooltip bei Hover', () => {
    const { container } = render(
      React.createElement(ProjectionInfo, {
        method: 'linear',
        confidence: 0.7
      })
    );
    
    const infoIcon = container.querySelector('[data-lucide="info"]');
    fireEvent.mouseEnter(infoIcon);
    
    expect(container.querySelector('.absolute')).toBeInTheDocument();
  });

  test('zeigt korrekte Methodenbeschreibung für linear', () => {
    const { container } = render(
      React.createElement(ProjectionInfo, {
        method: 'linear',
        confidence: 0.7
      })
    );
    
    const infoIcon = container.querySelector('[data-lucide="info"]');
    fireEvent.mouseEnter(infoIcon);
    
    expect(screen.getByText(/Lineare Hochrechnung/)).toBeInTheDocument();
  });

  test('zeigt korrekte Konfidenz-Label', () => {
    const testCases = [
      { confidence: 0.9, expected: 'Hoch' },
      { confidence: 0.7, expected: 'Mittel' },
      { confidence: 0.3, expected: 'Niedrig' }
    ];

    testCases.forEach(({ confidence, expected }) => {
      const { container, rerender } = render(
        React.createElement(ProjectionInfo, {
          method: 'linear',
          confidence
        })
      );
      
      const infoIcon = container.querySelector('[data-lucide="info"]');
      fireEvent.mouseEnter(infoIcon);
      
      expect(screen.getByText(expected)).toBeInTheDocument();
      
      rerender(null);
    });
  });

  test('versteckt Tooltip bei Mouse Leave', () => {
    const { container } = render(
      React.createElement(ProjectionInfo, {
        method: 'linear',
        confidence: 0.7
      })
    );
    
    const infoIcon = container.querySelector('[data-lucide="info"]');
    fireEvent.mouseEnter(infoIcon);
    fireEvent.mouseLeave(infoIcon);
    
    expect(container.querySelector('.absolute')).not.toBeInTheDocument();
  });
});