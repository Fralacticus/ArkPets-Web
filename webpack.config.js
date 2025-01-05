const path = require('path');

module.exports = {
  entry: './js/globals.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.glsl$/,
        type: 'asset/source'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'arkpets.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'arkpets',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, '/'),
    },
    compress: true,
    port: 9000
  },
}; 