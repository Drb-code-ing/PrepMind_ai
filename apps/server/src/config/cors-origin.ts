type NodeEnv = 'development' | 'test' | 'production';

export function isCorsOriginAllowed(
  origin: string | undefined,
  options: {
    configuredOrigins: string;
    nodeEnv: NodeEnv;
  },
): boolean {
  if (!origin) return true;

  const allowedOrigins = parseConfiguredOrigins(options.configuredOrigins);
  if (allowedOrigins.has(origin)) return true;

  if (options.nodeEnv !== 'production') {
    return isLocalDevelopmentOrigin(origin);
  }

  return false;
}

export function createCorsOriginValidator(options: {
  configuredOrigins: string;
  nodeEnv: NodeEnv;
}) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    callback(null, isCorsOriginAllowed(origin, options));
  };
}

function parseConfiguredOrigins(value: string) {
  return new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1' ||
      isPrivateIpv4(url.hostname)
    );
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
