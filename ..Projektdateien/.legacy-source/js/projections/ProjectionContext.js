// js/projections/ProjectionContext.js

import { hooks } from '../hooks.js';
import { ProjectionConfig } from './interfaces/ProjectionTypes.js';

const ProjectionContext = React.createContext(null);

export const ProjectionProvider = ({ children }) => {
  const [config, setConfig] = hooks.useState(new ProjectionConfig());

  const value = {
    config,
    setMethod: (method) => {
      setConfig(prev => ({ ...prev, method }));
    },
    setShowProjections: (show) => {
      setConfig(prev => ({ ...prev, showProjections: show }));
    },
    toggleProjections: () => {
      setConfig(prev => ({ ...prev, showProjections: !prev.showProjections }));
    }
  };

  return React.createElement(
    ProjectionContext.Provider,
    { value },
    children
  );
};

export const useProjection = () => {
  const context = hooks.useContext(ProjectionContext);
  if (!context) {
    throw new Error('useProjection muss innerhalb eines ProjectionProviders verwendet werden');
  }
  return context;
};