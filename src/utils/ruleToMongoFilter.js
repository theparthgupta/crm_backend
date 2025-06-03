function ruleToMongoFilter(rule) {
  if (!rule) return {};

  if (rule.operator && Array.isArray(rule.conditions)) {
    const subFilters = rule.conditions.map(ruleToMongoFilter);
    if (rule.operator === 'AND') return { $and: subFilters };
    if (rule.operator === 'OR') return { $or: subFilters };
  }

  const { field, operator, value } = rule;
  switch (operator) {
    case '>': return { [field]: { $gt: value } };
    case '>=': return { [field]: { $gte: value } };
    case '<': return { [field]: { $lt: value } };
    case '<=': return { [field]: { $lte: value } };
    case '==': return { [field]: value };
    case '!=': return { [field]: { $ne: value } };
    default: return {};
  }
}

module.exports = ruleToMongoFilter;
