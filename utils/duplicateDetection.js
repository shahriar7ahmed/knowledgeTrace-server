// Utility functions for duplicate detection using Jaccard similarity

/**
 * Calculate Jaccard similarity between two text abstracts
 * @param {string} abstract1 - First abstract text
 * @param {string} abstract2 - Second abstract text
 * @returns {number} Similarity percentage (0-100)
 */
function calculateSimilarity(abstract1, abstract2) {
    if (!abstract1 || !abstract2) return 0;

    // Convert to lowercase and tokenize by whitespace and punctuation
    const tokenize = (text) => {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .split(/\s+/)
            .filter(token => token.length > 2); // Filter out very short tokens
    };

    const tokens1 = new Set(tokenize(abstract1));
    const tokens2 = new Set(tokenize(abstract2));

    // Calculate Jaccard index: |intersection| / |union|
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) return 0;

    return (intersection.size / union.size) * 100; // Return percentage
}

/**
 * Check if a project abstract is a potential duplicate
 * @param {string} newAbstract - Abstract to check
 * @param {Array} existingProjects - Array of existing projects with abstracts
 * @param {number} threshold - Similarity threshold percentage (default 60%)
 * @returns {Object} { isDuplicate: boolean, matches: Array, highestMatch: number }
 */
function checkDuplicate(newAbstract, existingProjects, threshold = 60) {
    if (!newAbstract || !existingProjects || existingProjects.length === 0) {
        return { isDuplicate: false, matches: [], highestMatch: 0 };
    }

    const matches = [];
    let highestMatch = 0;

    for (const project of existingProjects) {
        if (!project.abstract) continue;

        const similarity = calculateSimilarity(newAbstract, project.abstract);

        if (similarity >= threshold) {
            matches.push({
                projectId: project._id,
                title: project.title,
                similarity: Math.round(similarity),
                year: project.year
            });
        }

        if (similarity > highestMatch) {
            highestMatch = similarity;
        }
    }

    return {
        isDuplicate: matches.length > 0,
        matches: matches.sort((a, b) => b.similarity - a.similarity), // Sort by similarity desc
        highestMatch: Math.round(highestMatch)
    };
}

module.exports = {
    calculateSimilarity,
    checkDuplicate,
};
