// js/projections/components/ProjectionInfo.js

import { hooks } from '../../hooks.js';

const ProjectionInfo = ({ method, confidence, className = '' }) => {
  const [isVisible, setIsVisible] = hooks.useState(false);

  const getMethodDescription = () => {
    switch (method) {
      case 'linear':
        return 'Lineare Hochrechnung basierend auf dem Durchschnitt der bisherigen Monate';
      case 'weighted':
        return 'Gewichtete Hochrechnung unter Berücksichtigung der Vorjahresdaten';
      default:
        return 'Keine Berechnungsmethode ausgewählt';
    }
  };

  const getConfidenceLabel = () => {
    if (confidence >= 0.8) return 'Hoch';
    if (confidence >= 0.5) return 'Mittel';
    return 'Niedrig';
  };

  const getConfidenceColor = () => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return React.createElement(
    'div',
    {
      className: `relative inline-block ${className}`,
      onMouseEnter: () => setIsVisible(true),
      onMouseLeave: () => setIsVisible(false)
    },
    [
      // Info Icon mit Hover-Effekt
      React.createElement(
        'i',
        {
          'data-lucide': 'info',
          className: 'w-4 h-4 text-[#9b59b6] cursor-help transition-colors hover:text-[#8e44ad]',
          key: 'info-icon'
        }
      ),
      
      // Tooltip/Popover
      isVisible && React.createElement(
        'div',
        {
          className: `
            absolute z-50 w-64 p-4 mt-2 
            bg-[#34495e] text-white rounded-lg shadow-lg
            border border-[#9b59b6]
          `,
          style: {
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)'
          },
          key: 'tooltip'
        },
        [
          // Methoden-Beschreibung
          React.createElement(
            'div',
            {
              className: 'mb-3',
              key: 'method-description'
            },
            [
              React.createElement(
                'h4',
                {
                  className: 'font-bold mb-1',
                  key: 'method-title'
                },
                'Berechnungsmethode'
              ),
              React.createElement(
                'p',
                {
                  className: 'text-sm',
                  key: 'method-text'
                },
                getMethodDescription()
              )
            ]
          ),

          // Konfidenz-Anzeige
          React.createElement(
            'div',
            {
              className: 'mb-3',
              key: 'confidence-section'
            },
            [
              React.createElement(
                'h4',
                {
                  className: 'font-bold mb-1',
                  key: 'confidence-title'
                },
                'Verlässlichkeit'
              ),
              React.createElement(
                'div',
                {
                  className: 'flex items-center gap-2',
                  key: 'confidence-display'
                },
                [
                  React.createElement(
                    'span',
                    {
                      className: `font-bold ${getConfidenceColor()}`,
                      key: 'confidence-label'
                    },
                    getConfidenceLabel()
                  ),
                  React.createElement(
                    'span',
                    {
                      className: 'text-sm',
                      key: 'confidence-value'
                    },
                    `(${Math.round(confidence * 100)}%)`
                  )
                ]
              )
            ]
          ),

          // Hinweis
          React.createElement(
            'p',
            {
              className: 'text-xs text-gray-300 italic',
              key: 'hint'
            },
            'Hochrechnungen basieren auf aktuellen Daten und können von der tatsächlichen Entwicklung abweichen.'
          )
        ]
      )
    ]
  );
};

export default ProjectionInfo;