const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");

module.exports = {
    mode: "production",
    entry: "./app/index.ts",
    output: {
        path: path.resolve(__dirname, "dist/"),
        filename: "[name].bundle.js",
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "PVS Breath Pacer",
            filename: "index.html",
            template: "app/index.ejs",
        }),
        new MiniCssExtractPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/i,
                loader: "ts-loader",
                exclude: /node_modules/,
                options: {
                    compilerOptions: {
                        outDir: "dist/",
                        declaration: false,
                    },
                },
            },
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
        ],
    },
    resolve: {
        modules: [
            path.resolve(__dirname),
            path.resolve(__dirname, "node_modules/"),
        ],
        extensions: ['.tsx', '.ts', '.js'],
    },
};
