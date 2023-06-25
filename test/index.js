/// @ts-check

const assert = require('assert');
const fs = require('fs');
const fsPromise = fs.promises;
const path = require('path');
const { simpleGit } = require('simple-git');
const { sequentialMerge, getNonExistingBranches } = require('../src/sequential-merge');

const baseDir = 'test-temp';

(async () => {
    if (await existsDir(baseDir)) {
        console.error(`temporary directory '${baseDir}' exists.`);
        process.exit(1);
    }

    await testCase('lsTree', async git => {
        console.log(await git.branch());
        await git.checkoutLocalBranch('branch');
        await createAndCommit(git, 'b.txt', 'content');
        console.log(await git.branch());
        await fsPromise.writeFile(toTempPath('a.txt'), 'aaaa');
        console.log(await listFiles(git));
    });

    await testCase('simple', async git => {
        const branches = ['branch1', 'branch2', 'branch3'];

        await git.checkoutLocalBranch(branches[0]);
        await createAndCommit(git, 'a.txt', 'aaa');
        await git.checkoutLocalBranch(branches[1]);
        await createAndCommit(git, 'b.txt', 'content');
        await git.checkoutLocalBranch(branches[2]);

        const r = await sequentialMerge(baseDir, branches);

        assert.ok(!r);
    });

    await testCase('branchExistence', async git => {
        const branches = ['branch1', 'branch2', 'branch3', 'branch4', 'branch5'];

        await git.checkoutLocalBranch(branches[0]);
        await createAndCommit(git, 'a.txt', 'aaa');
        await git.checkoutLocalBranch(branches[1]);
        await createAndCommit(git, 'b.txt', 'content');
        await git.checkoutLocalBranch(branches[2]);

        assert.deepStrictEqual(
            await getNonExistingBranches(baseDir, branches),
            [branches[3], branches[4]]);
    });

    await testCase('conflict', async git => {
        const branches = ['branch1', 'branch2', 'branch3'];

        await git.checkoutLocalBranch(branches[0]);
        await createAndCommit(git, 'a.txt', 'aaa');
        await git.checkoutLocalBranch(branches[1]);
        await createAndCommit(git, 'b.txt', 'content');
        await createAndCommit(git, 'a.txt', 'bbb');
        await git.checkout(branches[0]);
        await createAndCommit(git, 'a.txt', 'cccc');
        await git.checkoutLocalBranch(branches[2]);

        const r = await sequentialMerge(baseDir, branches);

        assert.deepStrictEqual(r, { base: branches[0], head: branches[1], conflicts: ['a.txt'] });
    });

    await testCase('nonExistingBranch', async git => {
        const branches = ['branch1', 'branch2', 'branch3', 'branch4'];

        await git.checkoutLocalBranch(branches[0]);
        await createAndCommit(git, 'a.txt', 'aaa');
        await git.checkoutLocalBranch(branches[1]);
        await createAndCommit(git, 'b.txt', 'content');
        await git.checkoutLocalBranch(branches[2]);

        await assert.rejects(sequentialMerge(baseDir, branches));
    });
})();

function toTempPath(p) {
    return path.join(baseDir, p);
}

async function existsDir(dir) {
    try {
        const stat = await fsPromise.lstat(dir);
        return stat.isDirectory();
    }
    catch {
        return false;
    }
}

/**
 * 
 * @param {import('simple-git').SimpleGit} git 
 * @param {string} filePath 
 * @param {string} content 
 */
async function createAndCommit(git, filePath, content) {
    await fsPromise.writeFile(toTempPath(filePath), content);
    await git.add(filePath);
    await git.commit(`create ${filePath}`);
}

/**
 * 
 * @param {import('simple-git').SimpleGit} git 
 */
async function listFiles(git) {
    return (await git
        .raw(['ls-tree', '-r', '--name-only', (await git.branch()).current])
    ).split('\n').filter(x => x);
}

/**
 * @param {string} name
 * @param {(git: import('simple-git').SimpleGit) => Promise} runner 
 */
async function testCase(name, runner) {
    try {
        console.log(`run test case '${name}'`);

        await fsPromise.mkdir(baseDir);

        const git = simpleGit(baseDir);
        await git.init();

        await runner(git);
    }
    catch (e) {
        console.error(e);
        console.error(`case '${name}' failed.`);

        try {
            await fsPromise.rmdir(baseDir, { recursive: true });
        }
        catch {
        }

        process.exit(1);
    }
    finally {
        await fsPromise.rmdir(baseDir, { recursive: true });
    }
}
