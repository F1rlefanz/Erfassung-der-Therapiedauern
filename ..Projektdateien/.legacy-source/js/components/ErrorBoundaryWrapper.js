// js/components/ErrorBoundaryWrapper.js
import { ReactErrorBoundary } from '../reactV18Check.js';

export const ErrorBoundaryWrapper = ({ children }) => {
    return React.createElement(ReactErrorBoundary, null, children);
};