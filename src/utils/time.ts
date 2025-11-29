export const toWsTimestamp = (date: Date): string => {
  // Format as YYYY-MM-DDTHH:mm:ssZ required by AFIP/ARCA
  return date.toISOString().slice(0, 19) + 'Z';
};

export const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

export const isExpired = (expiresAt: Date, skewMs = 60_000): boolean => {
  return expiresAt.getTime() - skewMs <= Date.now();
};
