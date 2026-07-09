interface ResolveLearningAppUrlInput {
  explicitUrl?: string;
  location?: Pick<Location, 'protocol' | 'hostname'> | URL;
}

export function resolveLearningAppUrl(input: ResolveLearningAppUrlInput = {}) {
  const explicitUrl = input.explicitUrl?.trim();
  if (explicitUrl) return explicitUrl;

  const location = input.location;
  if (!location) return 'http://127.0.0.1:3000';

  return `${location.protocol}//${location.hostname}:3000`;
}
