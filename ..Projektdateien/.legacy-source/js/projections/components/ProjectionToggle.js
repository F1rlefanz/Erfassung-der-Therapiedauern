// js/projections/components/ProjectionToggle.js

import { hooks } from '../../hooks.js';

const ProjectionToggle = ({ onChange, value }) => {  // Props richtig deklarieren
    const [isEnabled, setIsEnabled] = hooks.useState(value || false);

    const handleToggle = () => {
        const newState = !isEnabled;
        setIsEnabled(newState);
        // Nur aufrufen wenn onChange als Prop übergeben wurde
        if (typeof onChange === 'function') {
            onChange(newState);
        }
    };

    return React.createElement(
        'button',
        {
            onClick: handleToggle,
            className: `inline-flex items-center gap-2 px-4 py-2 bg-[#9b59b6] text-white rounded 
                       hover:bg-[#8e44ad] transition-colors`,
            type: 'button',
            role: 'switch',
            'aria-checked': isEnabled
        },
        [
            // Toggle-Switch
            React.createElement('span', {
                key: 'switch',
                className: `relative inline-flex h-6 w-11 items-center rounded-full 
                           ${isEnabled ? 'bg-[#2ecc71]' : 'bg-gray-700'} 
                           transition-colors duration-200`
            },
                React.createElement('span', {
                    className: `inline-block h-4 w-4 transform rounded-full bg-white 
                               transition-transform duration-200
                               ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`
                })
            ),
            // Label
            React.createElement('span', {
                key: 'label',
                className: 'font-medium'
            }, 'Hochrechnungen anzeigen'),
            // Info Icon
            React.createElement('i', {
                key: 'icon',
                'data-lucide': 'info',
                className: 'w-4 h-4'
            })
        ]
    );
};

export default ProjectionToggle;