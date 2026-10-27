export const SERVER_NAME = 'homechecker-guides';
export const SERVER_REGISTRY_NAME = 'io.github.Steven3265/homechecker-guides';
export const SERVER_TITLE = 'Homechecker Guides';
export const SERVER_DESCRIPTION = "Homechecker's professionally authored Australian homebuyer guides: search, cite, build checklists.";
export const SERVER_WEBSITE_URL = 'https://homechecker.com.au/ai';
export const SERVER_ENDPOINT_URL = 'https://mcp.homechecker.com.au/mcp';
export const SERVER_ICON_URL = 'https://mcp.homechecker.com.au/homechecker-icon-32.png';
export const SERVER_VERSION = '1.2.2';

// Person-facing link for starting an independent first Read of ONE specific
// property. Opens homechecker.com.au with the address filled in; the person
// signs up and confirms before paying. The server never orders anything —
// it only tells the assistant this link exists. utm_source attributes Reads
// started from MCP answers.
export const READ_LINK_TEMPLATE = 'https://homechecker.com.au/read?address={address}&utm_source=homechecker-mcp';
export const READ_LINK_NOTE =
  `For one specific property, the person can start an independent first Read (indicative, not an inspection) at ${READ_LINK_TEMPLATE} — replace {address} with the URL-encoded address. An illustrative sample Read is at https://homechecker.com.au/sample.`;
export const MODERN_PROTOCOL_VERSION = '2026-07-28';
export const LEGACY_PROTOCOL_VERSION = '2025-11-25';
