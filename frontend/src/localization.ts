export function localizedApiUrl(url: string, languageCode: string | undefined): string {
  const normalizedLanguage = languageCode?.toLowerCase().split(/[-_]/, 1)[0];
  const language = normalizedLanguage === 'ru' || normalizedLanguage === 'uk' || normalizedLanguage === 'en'
    ? normalizedLanguage
    : 'en';
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const requestUrl = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = requestUrl.indexOf('?');
  const path = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : requestUrl.slice(queryIndex + 1));

  params.set('lang', language);
  return `${path}?${params.toString()}${hash}`;
}
