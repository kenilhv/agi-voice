/**
 * Web-local ESLint config: reuses the shared root rules and only adds ignores for
 * Next.js-generated files that the app does not own.
 */
import rootConfig from '../../eslint.config.js';

export default [...rootConfig, { ignores: ['next-env.d.ts', '.next/**'] }];
