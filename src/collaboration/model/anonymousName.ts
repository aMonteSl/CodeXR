const STAR_WARS_PRIMARY_NAMES = [
    'Anakin',
    'Leia',
    'Luke',
    'Rey',
    'Ahsoka',
    'Padme',
    'Lando',
    'Mace',
    'Yoda',
    'Jyn',
    'Sabine',
    'Din',
];

const STAR_WARS_SECONDARY_NAMES = [
    'Skywalker',
    'Kenobi',
    'Palpatine',
    'Organa',
    'Solo',
    'Amidala',
    'Tano',
    'Jinn',
    'Fett',
    'Dooku',
    'Erso',
    'Syndulla',
];

export function buildStarWarsDisplayName(index: number): string {
    const normalizedIndex = Math.max(0, Math.floor(index));
    if (normalizedIndex < STAR_WARS_PRIMARY_NAMES.length) {
        return STAR_WARS_PRIMARY_NAMES[normalizedIndex];
    }

    const compositeIndex = normalizedIndex - STAR_WARS_PRIMARY_NAMES.length;
    const pairSpace = STAR_WARS_PRIMARY_NAMES.length * STAR_WARS_SECONDARY_NAMES.length;
    const cycle = Math.floor(compositeIndex / pairSpace);
    const pairIndex = compositeIndex % pairSpace;
    const firstName = STAR_WARS_PRIMARY_NAMES[Math.floor(pairIndex / STAR_WARS_SECONDARY_NAMES.length)];
    const secondName = STAR_WARS_SECONDARY_NAMES[pairIndex % STAR_WARS_SECONDARY_NAMES.length];
    const composed = `${firstName} ${secondName}`;
    return cycle > 0 ? `${composed} ${cycle + 1}` : composed;
}
