// Deployment links are NOT changed by this rewrite: the default backend is the same Cloud Run service as before.
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'survey-risk-v6';
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://charis-detection-backend-376770076331.europe-west1.run.app';
