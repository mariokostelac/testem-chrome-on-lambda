const path = require('path')
const decompress = require('decompress')
const webpack = require('webpack')

const chromeTarball = path.join(__dirname, 'chrome/chrome-headless-lambda.tar.gz')
const webpackDir = path.join(__dirname, '.webpack/')

function extractTarball (archive, to) {
  return {
    apply: (compiler) => {
      compiler.plugin('emit', (compilation, callback) => {
        decompress(path.resolve(archive), path.resolve(to))
          .then(() => callback())
          .catch(error => console.error('Unable to extract archive ', archive, to, error.stack))
      })
    },
  }
}

module.exports = {
  entry: './src/remote/handler',
  target: 'node',
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: __dirname,
        exclude: /node_modules/,
      },
      { test: /\.json$/, loader: 'json-loader' },
    ],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve('.webpack'),
    filename: 'handler.js',
  },
  externals: [
    'aws-sdk', // we have this provided on the box
    'electron', // got needs this
  ],
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new extractTarball(chromeTarball, webpackDir),
  ],
}
