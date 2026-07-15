export function telegramAuthHeaders(initDataRaw: string | undefined): HeadersInit {
  return initDataRaw ? { Authorization: `tma ${initDataRaw}` } : {};
}
