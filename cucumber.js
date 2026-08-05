module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    require: ["src/support/**/*.js", "src/steps/**/*.js"],
    publishQuiet: true
  }
};
