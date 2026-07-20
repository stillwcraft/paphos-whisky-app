export function localizedApiUrl(url: string, languageCode: string | undefined): string {
  const normalizedLanguage = languageCode?.toLowerCase().split(/[-_]/, 1)[0];
  const language = normalizedLanguage === 'ru' || normalizedLanguage === 'uk' || normalizedLanguage === 'en'
    ? normalizedLanguage
    : 'en';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${language}`;
}
