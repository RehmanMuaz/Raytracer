module.exports = {
  webpack: {
    configure: (config) => {
      console.log("craco.config.js is being executed");
      console.log("Webpack Configuration:", config.module.rules);

      // Add a rule to handle .glsl files
      config.module.rules.push({
        test: /\.glsl$/,
        use: "raw-loader",
      });

      return config;
    },
  },
};
