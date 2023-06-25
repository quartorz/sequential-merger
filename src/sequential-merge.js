/// @ts-check

const { simpleGit, GitResponseError } = require('simple-git');
const assert = require('assert');

/**
 * @param {string} baseDir 
 * @param {string[]} branches
 * @returns {Promise<{ base: string, head: string, conflicts: string[] | null } | null>}
 */
exports.sequentialMerge = async function sequentialMerge(baseDir, branches) {
    assert.ok(baseDir);
    assert.ok(branches);

    const git = simpleGit(baseDir);

    for (let i = 1; i < branches.length; ++i) {
        await git.checkout(branches[i]);
        try {
            await git.merge([branches[i - 1]]);
        }
        catch (e) {
            /** @type {string[] | null} */
            let conflicts = null;

            if (e instanceof GitResponseError) {
                conflicts = /** @type {string[]} */ ((/**
                    @type {GitResponseError<import('simple-git').MergeResult>} */(e))
                    .git.conflicts.map(x => x.file).filter(x => x));
            }

            return {
                base: branches[i - 1],
                head: branches[i],
                conflicts,
            };
        }
    }

    return null;
}

/**
 * @param {string} baseDir
 * @param {string[]} branches 
 * @returns {Promise<string[]>} names of branches that does not exist
 */
exports.getNonExistingBranches = async function getNonExistingBranches(baseDir, branches) {
    assert.ok(baseDir);
    assert.ok(branches);

    const git = simpleGit(baseDir);
    
    const b = await git.branch();
    
    return branches.filter(x => !b.all.includes(x));
}
