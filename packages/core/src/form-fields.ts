import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { Node, SyntaxKind, type JsxElement } from 'ts-morph';

type FieldAttributes = Record<string, string>;
const FIELD_TAGS = new Set(['input', 'textarea', 'select']);
function isFieldTag(name: string): boolean {
  return FIELD_TAGS.has(name.toLowerCase()) || /(?:input|textarea|select|textfield)$/i.test(name);
}
const PII_TYPE = /^(email|tel)$/i;
const NON_PII_TYPE = /^(hidden|checkbox|radio|button|submit|reset|image)$/i;

function personalDataMarker(value: string): boolean {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return /(?:^| )(?:e ?mail|phone|telephone|tel|mobile|fio|имя|телефон|почта|фамилия|отчество)(?: |$)/u.test(words) ||
    /^(?:(?:user|customer|contact|person|your) )?(?:(?:full|first|last|given|middle|family) )?name$/.test(words);
}

function isPersonalDataField(attributes: FieldAttributes, labels: string[]): boolean {
  if (NON_PII_TYPE.test(attributes.type ?? '')) return false;
  if (PII_TYPE.test(attributes.type ?? '')) return true;
  return ['name', 'id', 'autocomplete', 'aria-label', 'placeholder'].some((key) =>
    personalDataMarker(attributes[key] ?? ''),
  ) || labels.some(personalDataMarker);
}

type HtmlNode = DefaultTreeAdapterMap['node'];

export function htmlFormHasPii(source: string): boolean {
  const fields: { attributes: FieldAttributes; labels: string[] }[] = [];
  const labelsById = new Map<string, string[]>();
  const text = (node: HtmlNode): string => {
    if ('value' in node) return node.value;
    return 'childNodes' in node ? node.childNodes.map(text).join(' ') : '';
  };
  const visit = (node: HtmlNode, enclosingLabels: string[] = []) => {
    let labels = enclosingLabels;
    if ('tagName' in node) {
      const attributes = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (node.tagName === 'label') {
        const label = text(node);
        labels = [...labels, label];
        if (attributes.for) labelsById.set(attributes.for, [...(labelsById.get(attributes.for) ?? []), label]);
      }
      if (isFieldTag(node.tagName)) fields.push({ attributes, labels });
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child, labels);
  };
  visit(parseFragment(source));
  return fields.some(({ attributes, labels }) =>
    isPersonalDataField(attributes, [...labels, ...(labelsById.get(attributes.id) ?? [])]),
  );
}

function jsxAttributes(node: Node): FieldAttributes {
  if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node)) return {};
  const attributes: FieldAttributes = {};
  for (const attribute of node.getAttributes()) {
    if (!Node.isJsxAttribute(attribute)) continue;
    let value: Node | undefined = attribute.getInitializer();
    if (value && Node.isJsxExpression(value)) value = value.getExpression();
    if (value && (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))) {
      attributes[attribute.getNameNode().getText().toLowerCase()] = value.getLiteralValue();
    }
  }
  return attributes;
}

export function jsxFormHasPii(form: JsxElement): boolean {
  const labels = form.getDescendantsOfKind(SyntaxKind.JsxElement).filter((element) =>
    element.getOpeningElement().getTagNameNode().getText().toLowerCase() === 'label',
  );
  const labelText = (label: JsxElement) => label.getJsxChildren()
    .filter(Node.isJsxText).map((child) => child.getText()).join(' ');
  return form.getDescendants().some((node) => {
    if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node)) return false;
    if (!isFieldTag(node.getTagNameNode().getText())) return false;
    const attributes = jsxAttributes(node);
    const relevantLabels = labels.filter((label) => {
      const target = jsxAttributes(label.getOpeningElement()).htmlfor;
      return (target && target === attributes.id) || node.getAncestors().includes(label);
    });
    return isPersonalDataField(attributes, relevantLabels.map(labelText));
  });
}
