const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Force Metro to load CommonJS variants of Zustand to avoid import.meta errors
    if (moduleName === 'zustand') {
        return {
            filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
            type: 'sourceFile',
        };
    }
    if (moduleName.startsWith('zustand/')) {
        const subpath = moduleName.replace('zustand/', '');
        return {
            filePath: path.resolve(__dirname, `node_modules/zustand/${subpath}.js`),
            type: 'sourceFile',
        };
    }

    // Optionally allow default resolver
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
