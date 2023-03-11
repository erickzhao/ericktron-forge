const rules = require("./webpack.rules");

rules.push(
  ...[
    { test: /\.(html)$/, use: ["html-loader"] },
    {
      test: /\.css$/,
      use: [{ loader: "style-loader" }, { loader: "css-loader" }],
    },
  ]
);

const cfg = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
};

module.exports = cfg;
