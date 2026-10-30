/**
 * Size Manager: the 8 default category templates (the owner's initial spec, 2026-10-30). Used only to seed D1
 * (scripts/build-size-seed.mjs → migrations/d1/0002_size_manager_seed.sql); after that, D1 is the source of truth
 * and everything here is editable from the admin panel. Every category starts switched off.
 * `legacy` names the old size list (size-core.js LEGACY_SLOTS) an existing product keeps for that field.
 */
const range = (from, to) => { const out = []; for (let n = from; n <= to; n += 2) out.push(String(n)); return out; };
const field = (key, label_bn, label_en, options, extra = {}) => Object.assign({
  key, label_bn, label_en, required: true, enabled: true, allowCustom: false, default: '', legacy: [],
  options: options.map((o) => (typeof o === 'string' ? { value: o, label_bn: '', label_en: '' } : o))
}, extra);

export const SIZE_CATEGORIES = ['abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'hijab', 'panjabi', 'three-piece-dress'];

export const DEFAULT_TEMPLATES = [
  { id: 'abaya', name_bn: 'আবায়া', name_en: 'Abaya', fields: [
    field('body', '', 'Body', range(40, 52), { legacy: ['body'] }),
    field('length', '', 'Length', range(50, 58), { legacy: ['length'] })
  ] },
  { id: 'cover-up', name_bn: 'কভার আপ', name_en: 'Cover Up', fields: [
    field('body', '', 'Body', range(40, 50), { legacy: ['body'] }),
    field('length', '', 'Length', range(50, 58), { legacy: ['length'] }),
    field('sleeve', '', 'Sleeve Length', [], { required: false, allowCustom: true, legacy: ['sleeve'] })
  ] },
  { id: 'premium-two-piece', name_bn: 'প্রিমিয়াম টু-পিস', name_en: 'Premium Two-Piece', fields: [
    field('top', 'জামা', 'Top', range(36, 46), { legacy: ['body'] }),
    field('top_length', '', 'Top Length', range(38, 44), { legacy: ['dressLength'] }),
    field('sleeve', '', 'Sleeve Length', [], { required: false, legacy: ['sleeve'] }),
    field('bottom', 'পায়জামা / প্লাজু', 'Bottom', range(36, 46), { legacy: ['palazzo'] }),
    field('bottom_type', '', 'Bottom Type', ['Pajama', 'Plazo'], { required: false })
  ] },
  { id: 'tops-kurti', name_bn: 'টপস / কুর্তি', name_en: 'Tops/Kurti', fields: [
    field('size', '', 'Size', range(36, 46), { legacy: ['sizes'] }),
    field('length', '', 'Length', range(36, 44)),
    field('body', '', 'Body / Chest', [], { required: false, allowCustom: true }),
    field('sleeve', '', 'Sleeve Length', [], { required: false, allowCustom: true })
  ] },
  { id: 'embroidery', name_bn: 'এমব্রয়ডারি', name_en: 'Embroidery', fields: [
    field('garment', '', 'Garment Type', ['Abaya', 'Dress', 'Other']),
    field('body', '', 'Body', range(40, 50), { legacy: ['body'] }),
    field('length', '', 'Length', range(50, 58), { legacy: ['length'] })
  ] },
  { id: 'hijab', name_bn: 'হিজাব', name_en: 'Hijab', fields: [
    field('size', '', 'Size', ['Free Size'], { allowCustom: true, default: 'Free Size', legacy: ['sizes'] }),
    field('length', '', 'Length', [], { required: false, allowCustom: true }),
    field('width', '', 'Width', [], { required: false, allowCustom: true })
  ] },
  { id: 'panjabi', name_bn: 'পাঞ্জাবি', name_en: 'Panjabi', fields: [
    field('size', '', 'Size', [
      { value: 'M', label_bn: '', label_en: 'M (Length 40" • Body 42")' },
      { value: 'L', label_bn: '', label_en: 'L (Length 42" • Body 44")' },
      { value: 'XL', label_bn: '', label_en: 'XL (Length 44" • Body 46")' }
    ], { legacy: ['sizes'] })
  ] },
  { id: 'three-piece-dress', name_bn: 'থ্রি পিস ড্রেস', name_en: 'Three Piece Dress', fields: [
    field('top', 'জামা', 'Top', range(36, 46), { legacy: ['sizes', 'body'] }),
    field('top_length', '', 'Top Length', range(38, 44), { legacy: ['dressLength'] }),
    field('bottom', 'পায়জামা / প্লাজু', 'Bottom', range(36, 46), { legacy: ['palazzo'] }),
    field('dupatta', '', 'Dupatta', ['Standard'], { required: false, allowCustom: true, default: 'Standard' })
  ] }
];

export const DEFAULT_CATEGORIES = SIZE_CATEGORIES.map((key) => ({ category_key: key, template_id: key, enabled: false }));
