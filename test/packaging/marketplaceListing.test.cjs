const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

/**
 * Relative luminance of an sRGB hex colour, per WCAG: linearize each channel,
 * then weight them by how much the eye sees of each.
 */
function relativeLuminance(hex) {
    const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
        .map((pair) => parseInt(pair, 16) / 255)
        .map((value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

test('the store one-liner survives being truncated on the listing card', () => {
    const { description } = packageJson;

    assert.ok(description.length > 0);

    // The card clips the one-liner, so an em dash can end up sitting at the cut
    // point, where it reads as a broken sentence rather than a separator.
    assert.doesNotMatch(description, /—/, 'use a colon or a comma, not an em dash');

    assert.ok(
        description.length <= 200,
        `the listing card shows roughly 200 characters; this is ${description.length}`,
    );
});

test('the listing links to the project site', () => {
    // Published by the Marketplace as Links.Learn, the sidebar link on the page.
    assert.equal(packageJson.homepage, 'https://code-xr.adrianmonteslinares.com/');
    assert.ok(packageJson.homepage.startsWith('https://'));
});

test('the gallery banner declares the theme its own colour needs', () => {
    const banner = packageJson.galleryBanner;

    assert.ok(banner, 'galleryBanner is what paints the listing header');
    assert.match(banner.color, /^#[0-9a-f]{6}$/, 'a six-digit lowercase hex colour');
    assert.ok(['dark', 'light'].includes(banner.theme));

    // The Marketplace draws the header text from the theme alone: it never
    // inspects the colour. Declaring the wrong one, or picking a colour with no
    // clear answer, is how the title ends up illegible on its own background.
    const luminance = relativeLuminance(banner.color);

    if (banner.theme === 'dark') {
        assert.ok(
            luminance < 0.35,
            `theme "dark" wants light text, so the colour must be dark; luminance is ${luminance.toFixed(2)}`,
        );
    } else {
        assert.ok(
            luminance > 0.6,
            `theme "light" wants dark text, so the colour must be light; luminance is ${luminance.toFixed(2)}`,
        );
    }
});

test('the listing icon is a file that actually ships', () => {
    const { icon, files } = packageJson;

    assert.ok(icon, 'the icon is the only image the Marketplace renders for us');
    assert.ok(fs.existsSync(path.join(projectRoot, icon)), `${icon} is missing from the working tree`);

    // There is no .vscodeignore: the `files` allowlist is the whole gate, so an
    // icon outside it packages as a dangling reference.
    const topLevel = icon.split('/')[0];
    assert.ok(
        files.some((entry) => entry === topLevel || entry.startsWith(`${topLevel}/`)),
        `${topLevel}/ must be in the files allowlist for the icon to be packaged`,
    );
});
