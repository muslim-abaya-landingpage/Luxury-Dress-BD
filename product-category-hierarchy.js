/* Product Manager category hierarchy. Legacy sections without parentKey remain top-level. */
(function (g) {
  "use strict";
  function parentOptions(sections, currentKey) {
    return (Array.isArray(sections) ? sections : []).filter(function (section) {
      return section && section.key !== currentKey && !section.parentKey;
    });
  }
  function validateParent(sections, key, parentKey) {
    parentKey = String(parentKey || "").trim();
    if (!parentKey) return "";
    var current = (sections || []).find(function (section) { return section && section.key === key; });
    if (current && (sections || []).some(function (section) { return section && section.parentKey === key; })) {
      throw new Error("A category with subcategories must remain a top-level category.");
    }
    var parent = (sections || []).find(function (section) { return section && section.key === parentKey; });
    if (!parent || parent.parentKey || parent.key === key) {
      throw new Error("Choose a valid top-level parent category.");
    }
    return parentKey;
  }
  function ordered(sections) {
    sections = Array.isArray(sections) ? sections : [];
    var result = [], seen = Object.create(null);
    sections.forEach(function (parent) {
      if (!parent || parent.parentKey || seen[parent.key]) return;
      result.push(parent); seen[parent.key] = true;
      sections.forEach(function (child) {
        if (child && child.parentKey === parent.key && !seen[child.key]) {
          result.push(child); seen[child.key] = true;
        }
      });
    });
    sections.forEach(function (section) {
      if (section && !seen[section.key]) result.push(section);
    });
    return result;
  }
  g.MaCategoryHierarchy = { parentOptions: parentOptions, validateParent: validateParent, ordered: ordered };
})(window);
