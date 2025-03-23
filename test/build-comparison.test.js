// test/build-comparison.test.js
const fs = require('fs-extra');
const assert = require('assert');
const path = require('path');

async function compareDirectories(dir1, dir2) {
    const dir1Exists = await fs.pathExists(dir1);
    const dir2Exists = await fs.pathExists(dir2);

    if (!dir1Exists || !dir2Exists) {
        return dir1Exists === dir2Exists; // If one exists and the other doesn't, they are different
    }

    const dir1Contents = await fs.readdir(dir1);
    const dir2Contents = await fs.readdir(dir2);

    if (dir1Contents.length !== dir2Contents.length) {
        return false;
    }

    for (const item of dir1Contents) {
        const path1 = path.join(dir1, item);
        const path2 = path.join(dir2, item);

        if (!dir2Contents.includes(item)) {
            return false; // Item not found in dir2
        }

        const stat1 = await fs.stat(path1);
        const stat2 = await fs.stat(path2);

        if (stat1.isDirectory() && stat2.isDirectory()) {
            if (!await compareDirectories(path1, path2)) {
                return false; // Recursive comparison failed for subdirectory
            }
        } else if (stat1.isFile() && stat2.isFile()) {
            const content1 = await fs.readFile(path1);
            const content2 = await fs.readFile(path2);
            if (!content1.equals(content2)) {
                return false; // File contents are different
            }
        } else {
            return false; // Item types are different (e.g., file vs directory)
        }
    }

    return true; // Directories are identical
}

async function runTest() {
    const webpackDistDir = path.resolve(__dirname, '../dist-webpack');
    const viteDistDir = path.resolve(__dirname, '../dist');

    const areDirsEqual = await compareDirectories(webpackDistDir, viteDistDir);

    if (areDirsEqual) {
        console.log('Build comparison test passed: Webpack and Vite build outputs are identical.');
    } else {
        console.error('Build comparison test failed: Webpack and Vite build outputs are different.');
        assert.fail('Build outputs are not identical.');
    }
}

runTest().catch(error => {
    console.error('Test execution error:', error);
    assert.fail(`Test execution error: ${error.message}`);
});