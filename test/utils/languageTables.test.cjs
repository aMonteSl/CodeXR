const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Characterization of the two live language tables (1.2.1, roadmap W1-10).
 *
 * - utils/supportedLanguages decides what is ANALYSED: getAllSupportedExtensions
 *   (minus HTML) is the metric-analysis extension set of the watchers,
 *   isSupportedExtension is the code-analysis file predicate, and
 *   getLanguageByExtension routes HTML files to the DOM view by language name.
 * - utils/languageMetadata decides what is LABELLED: getLanguageForFile groups the
 *   "Files by Language" tree, marks files as supported in the workspace snapshot,
 *   and gates the XR file command.
 *
 * Only live consumers are named. The file-hash walk and fileDisplayUtils read
 * these tables too, but nothing calls them and W2 deletes both; that deletion
 * is no reason for this suite to change.
 *
 * They are written by hand, separately, and they do not agree (see KNOWN
 * DIVERGENCES below). Making them agree changes which files get analysed, so it
 * is a 1.3.0 item. 1.2.1 is behaviour-neutral: this suite freezes what both
 * tables answer today, so a cleanup around them that changes any answer turns
 * red instead of shipping.
 *
 * Both modules are plain data without a `vscode` import, so they are executed
 * straight from out/. If one of them ever starts to need the editor API, these
 * two requires throw.
 */
const analysed = require('../../out/utils/supportedLanguages.js');
const labelled = require('../../out/utils/languageMetadata.js');

/**
 * One row per language: display name, key of the analysis table (the value
 * getLanguageByExtension hands back as `icon`), and the extensions BOTH tables
 * list. Row order and extension order are not part of the contract: the two
 * tables already order Fortran differently, and every comparison below sorts.
 */
const LANGUAGES = [
    ['Python', 'python', ['.py', '.pyw', '.pyi']],
    ['Ruby', 'ruby', ['.rb', '.rbw']],
    ['Java', 'java', ['.java']],
    ['C', 'c', ['.c', '.h']],
    ['C++', 'cplusplus', ['.cpp', '.cxx', '.cc', '.hpp', '.hxx']],
    ['C#', 'csharp', ['.cs']],
    ['Erlang', 'erlang', ['.erl', '.hrl']],
    ['Fortran', 'fortran', ['.f90', '.f95', '.f03', '.f08', '.f']],
    ['GDScript', 'gdscript', ['.gd']],
    ['Go', 'go', ['.go']],
    ['JavaScript', 'javascript', ['.js', '.mjs', '.cjs']],
    ['Kotlin', 'kotlin', ['.kt', '.kts']],
    ['Lua', 'lua', ['.lua']],
    ['Objective-C', 'objectivec', ['.m', '.mm']],
    ['PHP', 'php', ['.php', '.phtml', '.php3', '.php4', '.php5']],
    ['Perl', 'perl', ['.pl', '.pm']],
    ['Scala', 'scala', ['.scala', '.sc']],
    ['Solidity', 'solidity', ['.sol']],
    ['Swift', 'swift', ['.swift']],
    ['TypeScript', 'typescript', ['.ts', '.tsx']],
    ['TTCN-3', 'ttcn3', ['.ttcn', '.ttcn3']],
    ['Vue', 'vue', ['.vue']],
    ['Zig', 'zig', ['.zig']],
    ['HTML', 'html', ['.html', '.htm', '.xhtml']],
];

/**
 * KNOWN DIVERGENCES - a 1.3.0 item (ROADMAP "left for 1.3.0": language-table
 * unification; audit dup-assets-and-small/DUP-02).
 *
 * 1. languageMetadata gives C++ three extensions the analysis table does not
 *    have. A `.hh` file is therefore listed under C++ in the tree and accepted by
 *    the XR file command, while the watchers and both analysis predicates (code
 *    and metric) treat it as not analysable.
 * 2. Two analysis-table keys are not the iconId languageMetadata uses for the
 *    same language.
 *
 * Whoever unifies the tables empties these two constants ON PURPOSE, in the
 * commit that changes the behaviour. Until then they must not grow or shrink.
 */
const LABELLED_BUT_NOT_ANALYSED = { 'C++': ['.c++', '.hh', '.h++'] };
const ICON_ID_WHERE_IT_IS_NOT_THE_KEY = { cplusplus: 'cpp', objectivec: 'objective-c' };

function sorted(values) {
    return [...values].sort();
}

function labelledExtensions(name, extensions) {
    return sorted([...extensions, ...(LABELLED_BUT_NOT_ANALYSED[name] || [])]);
}

function iconIdFor(key) {
    return ICON_ID_WHERE_IT_IS_NOT_THE_KEY[key] || key;
}

test('the analysis table accepts exactly the snapshot extensions, each claimed by one language', () => {
    // A sorted list, not a set: getLanguageByExtension answers with the first
    // language that lists an extension, so a duplicate would silently shadow one.
    assert.deepEqual(
        sorted(analysed.getAllSupportedExtensions()),
        sorted(LANGUAGES.flatMap(([, , extensions]) => extensions)),
    );
});

test('getLanguageByExtension names every snapshot extension and reports the table key as its icon', () => {
    for (const [name, key, extensions] of LANGUAGES) {
        for (const extension of extensions) {
            const config = analysed.getLanguageByExtension(extension);

            assert.ok(config, `${extension} must resolve to ${name}`);
            assert.deepEqual(
                { ...config, extensions: sorted(config.extensions) },
                { name, icon: key, extensions: sorted(extensions) },
                `what getLanguageByExtension('${extension}') returns`,
            );
            assert.equal(analysed.isSupportedExtension(extension), true, `${extension} is analysable`);
        }
    }
});

test('languageMetadata labels exactly the snapshot extensions plus the known label-only ones', () => {
    assert.deepEqual(
        sorted(labelled.SupportedLanguages.flatMap((language) => language.extensions)),
        sorted(LANGUAGES.flatMap(([name, , extensions]) => labelledExtensions(name, extensions))),
    );
    // The tree groups files by this name, so one language must stay one row.
    assert.deepEqual(
        sorted(labelled.SupportedLanguages.map((language) => language.name)),
        sorted(LANGUAGES.map(([name]) => name)),
    );
});

test('getLanguageForFile resolves every labelled extension to its language name and iconId', () => {
    for (const [name, key, extensions] of LANGUAGES) {
        for (const extension of labelledExtensions(name, extensions)) {
            // Goes through the lookup map built at load time, not through the array.
            const info = labelled.getLanguageForFile(`src/sample${extension}`);

            assert.ok(info, `${extension} must resolve to ${name}`);
            assert.deepEqual(
                { ...info, extensions: sorted(info.extensions) },
                { name, iconId: iconIdFor(key), extensions: labelledExtensions(name, extensions) },
                `what getLanguageForFile('src/sample${extension}') returns`,
            );
        }
    }
});

test('the two tables diverge today in exactly the known ways: three C++ extensions and two icon ids', () => {
    // Computed from the two modules alone, so this stays a statement about the
    // product even if the snapshot rows above are edited.
    const labelledButNotAnalysed = {};
    for (const language of labelled.SupportedLanguages) {
        const rejected = language.extensions.filter((extension) => !analysed.isSupportedExtension(extension));
        if (rejected.length > 0) {
            labelledButNotAnalysed[language.name] = sorted(rejected);
        }
    }
    assert.deepEqual(
        labelledButNotAnalysed,
        Object.fromEntries(
            Object.entries(LABELLED_BUT_NOT_ANALYSED).map(([name, extensions]) => [name, sorted(extensions)]),
        ),
        'extensions the tree labels but the engine refuses to analyse (known 1.3.0 item)',
    );

    const iconIdWhereItIsNotTheKey = {};
    let compared = 0;
    for (const extension of analysed.getAllSupportedExtensions()) {
        const config = analysed.getLanguageByExtension(extension);
        const info = labelled.getLanguageForFile(`src/sample${extension}`);

        // The opposite gap does not exist: an analysable file always has a label,
        // and both tables call its language the same (HTML routing keys on it).
        assert.ok(info, `${extension} is analysed, so the tree must be able to label it`);
        assert.equal(info.name, config.name, `${extension} belongs to one language in both tables`);

        if (config.icon !== info.iconId) {
            iconIdWhereItIsNotTheKey[config.icon] = info.iconId;
        }
        compared += 1;
    }
    assert.ok(compared > 0, 'canary: the loop above compared something');
    assert.deepEqual(
        iconIdWhereItIsNotTheKey,
        ICON_ID_WHERE_IT_IS_NOT_THE_KEY,
        'analysis-table keys that are not the iconId of the same language (known 1.3.0 item)',
    );
});

test('both lookups ignore case and answer null instead of guessing', () => {
    // File names arrive as the file system spells them: MAIN.CPP is still C++.
    assert.equal(analysed.getLanguageByExtension('.CPP')?.name, 'C++');
    assert.equal(analysed.isSupportedExtension('.Py'), true);
    assert.equal(labelled.getLanguageForFile('C:\\project\\Main.JAVA')?.name, 'Java');

    // Callers hand the analysis table what path.extname() returns, dot included.
    assert.equal(analysed.getLanguageByExtension('cpp'), null);
    assert.equal(analysed.getLanguageByExtension(''), null);
    assert.equal(analysed.getLanguageByExtension('.txt'), null);
    assert.equal(analysed.isSupportedExtension('.txt'), false);

    // languageMetadata takes a whole path and reads only its last extension.
    assert.equal(labelled.getLanguageForFile('src/app.test.ts')?.name, 'TypeScript');
    assert.equal(labelled.getLanguageForFile('src/app.ts.bak'), null);
    assert.equal(labelled.getLanguageForFile('Makefile'), null);
    assert.equal(labelled.getLanguageForFile('notes.txt'), null);
});
