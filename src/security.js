import { lookup } from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

export class ConversionError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'ConversionError';
    this.status = status;
  }
}

export function isPublicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === 'unicast' && !(
      ip.kind() === 'ipv4' && (ip.match(ipaddr.parse('0.0.0.0'), 8) || ip.match(ipaddr.parse('100.64.0.0'), 10) || ip.match(ipaddr.parse('192.0.0.0'), 24) || ip.match(ipaddr.parse('198.18.0.0'), 15) || ip.match(ipaddr.parse('192.0.0.0'), 29))
    );
  } catch { return false; }
}

export function parsePublicUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new ConversionError('Enter a valid public HTTP or HTTPS URL.', 400);
  let url;
  try { url = new URL(value); } catch { throw new ConversionError('Enter a valid public HTTP or HTTPS URL.', 400); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || url.port && !['80', '443'].includes(url.port)) {
    throw new ConversionError('Only public HTTP and HTTPS URLs on standard ports are supported.', 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') || !host.includes('.') && !net.isIP(host)) {
    throw new ConversionError('This URL does not point to a public website.', 400);
  }
  if (net.isIP(host) && !isPublicAddress(host)) throw new ConversionError('This URL does not point to a public website.', 400);
  url.hash = '';
  return url;
}

export async function resolvePublicUrl(value, resolver = lookup) {
  const url = parsePublicUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const records = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await resolver(host, { all: true, verbatim: true }).catch(() => []);
  if (!records.length || records.some(({ address }) => !isPublicAddress(address))) throw new ConversionError('The website resolved to a nonpublic or unavailable address.', 400);
  return { url, address: records[0].address, family: records[0].family };
}
