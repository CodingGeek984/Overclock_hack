export const COUNTRY_CODES = {
  KZ: '1',
  RU: '2',
  US: '3',
  DE: '4',
  TR: '5',
  UA: '6',
  UZ: '7',
  KG: '8',
  BY: '9',
  GB: '10',
  NG: '11',
  VN: '12',
  PH: '13',
  CN: '14',
  MA: '15',
  AZ: '16',
  NL: '17',
  RO: '18',
  GE: '19',
}

export const COUNTRY_NAMES = {
  1: 'Казахстан',
  2: 'Россия',
  3: 'США',
  4: 'Германия',
  5: 'Турция',
  6: 'Украина',
  7: 'Узбекистан',
  8: 'Кыргызстан',
  9: 'Беларусь',
  10: 'Великобритания',
  11: 'Нигерия',
  12: 'Вьетнам',
  13: 'Филиппины',
  14: 'Китай',
  15: 'Марокко',
  16: 'Азербайджан',
  17: 'Нидерланды',
  18: 'Румыния',
  19: 'Грузия',
}

const DEVICE_KNOWN_MOBILE = /iPhone|Pixel|Samsung|Huawei|iPad|known/i
const DEVICE_NEW_MOBILE = /Samsung S24|iPhone (1[0-5])|new/i
const DEVICE_DESKTOP = /MacBook|desktop|PC|web/i
const DEVICE_EMULATOR = /emulator/i
const DEVICE_VPN = /vpn/i
const DEVICE_PROXY = /proxy/i

const VPN_IP_PATTERNS = [
  /^185\.220\./,
  /^104\.218\./,
  /^45\.61\./,
  /^5\.188\./,
  /^2\.58\./,
  /^78\.128\./,
  /^195\.158\./,
]

export function deviceToCode(device) {
  const d = String(device ?? '')
  if (DEVICE_EMULATOR.test(d)) return '4'
  if (DEVICE_VPN.test(d)) return '5'
  if (DEVICE_PROXY.test(d)) return '6'
  if (DEVICE_NEW_MOBILE.test(d)) return '2'
  if (DEVICE_DESKTOP.test(d)) return '3'
  if (DEVICE_KNOWN_MOBILE.test(d)) return '1'
  return '1'
}

export const DEVICE_CODES = {
  1: 'known_mobile',
  2: 'new_mobile',
  3: 'known_desktop',
  4: 'android_emulator',
  5: 'browser_vpn',
  6: 'browser_proxy',
}

export function deviceCodeToName(code) {
  return DEVICE_CODES[String(code)] ?? `device_${code}`
}

export function detectVpn(ip, device, merchant = '') {
  const haystack = `${ip ?? ''} ${device ?? ''} ${merchant ?? ''}`
  if (VPN_IP_PATTERNS.some((re) => re.test(haystack))) return 1
  if (/vpn|proxy|emulator/i.test(haystack)) return 1
  return 0
}

export function countryCodeToName(code) {
  return COUNTRY_NAMES[String(code)] ?? `code_${code}`
}

export function countryToCode(countryCode) {
  return COUNTRY_CODES[String(countryCode)] ?? COUNTRY_CODES.KZ
}