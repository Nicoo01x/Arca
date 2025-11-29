import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: true,
  parseAttributeValue: true
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  format: false
});

export const parseXml = <T = unknown>(xml: string): T => {
  return parser.parse(xml) as T;
};

export const buildXml = (obj: unknown): string => {
  return builder.build(obj);
};
