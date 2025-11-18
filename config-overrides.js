module.exports = function override(config) {
  const shaderRule = {
    test: /\.(glsl|vs|fs|vert|frag)$/i,
    exclude: /node_modules/,
    type: "asset/source",
  };

  const rules = config.module.rules;
  const oneOfRule = rules.find((rule) => Array.isArray(rule.oneOf));

  if (oneOfRule) {
    oneOfRule.oneOf.unshift(shaderRule);
  } else {
    rules.push(shaderRule);
  }

  return config;
};
